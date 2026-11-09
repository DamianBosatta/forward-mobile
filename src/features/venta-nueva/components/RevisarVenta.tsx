import React, { useRef, useState, type ReactNode } from 'react'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ArrowLeft, ChevronRight } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, PieFijo, TotalsRow, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { direccionDeEntrega, nombreDelCliente, type ClienteNombrable } from '@/features/clientes/lib/cliente'
import { useAlcanzaStock } from '../hooks/useAlcanzaStock'
import { useRevalidarStockVenta } from '../hooks/useRevalidarStockVenta'
import { precioServidor, subtotalLinea, unidadesPorBultoDe, type LineaCarrito } from '../lib/carrito'
import { disponibleParaLinea, faltaStock, totalesEstimados, type YaReservadas } from '../lib/avisos'
import { mostrarNumero } from '../lib/linea'

interface Props {
  /** Qué paso de la venta dibuja: 'carrito' (paso 3: las líneas y "Continuar") o 'entrega' (paso 4: total y confirmar). */
  paso: 'carrito' | 'entrega'
  /** Paso 3: "Continuar" lleva a la entrega y facturación (apagado sin productos). */
  onContinuar?: () => void
  /** Paso 4: vuelve al carrito, por ejemplo a corregir lo que el confirmar rechazó. */
  onVolverAlCarrito?: () => void
  cliente: ClienteNombrable | null
  descuentoGeneral: number
  flete?: number
  /** "Mañana · reparto": cuándo y cómo se entrega, si ya se sabe. */
  entrega?: string
  /** El envío en curso (deshabilita el botón). */
  enviando: boolean
  error: string | null
  /** Confirmar: el flujo existente (`useConfirmarVenta().confirmar`), que manda la venta y pide el motivo si falta stock. */
  onConfirmar: () => void | Promise<void>
  /** Algo de la venta impide guardarla (flete o cesión inválidos, presupuesto sobre el tope): el botón queda apagado. */
  deshabilitado?: boolean
  /** Por qué no se puede confirmar, si es algo que el vendedor puede corregir. */
  motivoDeshabilitado?: string
  /** Tocar una línea: abre la pantalla de cantidad y oferta. */
  onEditarLinea: (linea: LineaCarrito) => void
  /** Abre "Elegir fragancias" del producto padre (`FraganciasSheet`); sin esto la revisión no las ofrece. */
  onElegirFragancias?: (padreId: string) => void
  /** Editando una venta: lo que ya tenía por producto; el servidor ya lo descontó del `disponible`. */
  yaReservadas?: YaReservadas
  /** Texto del botón; sin esto, "Confirmar venta". Editar usa "Guardar cambios". */
  etiquetaConfirmar?: string
  /** Por qué la venta va a quedar por autorizar (lo calcula `avisos`); sin motivos no hay aviso. */
  autorizacion?: string[]
  /** "Editar" de la sección Productos: vuelve al catálogo a sumar o sacar productos. */
  onEditarProductos?: () => void
  /** Lo que la venta nueva ajusta desde acá y no es una línea: datos de la entrega, descuento general, avisos, comisión. */
  ajustes?: ReactNode
  /** La barra superior ya dice "Revisar venta" y la dirección (mockup ventas-nueva-3): el cuerpo no las repite. */
  sinEncabezado?: boolean
}

/** "2 bultos × 12 = 24 u" si la cantidad es de cajas cerradas; si no, "4 u × $ 400,56". */
function detalleDe(l: LineaCarrito): string {
  const m = unidadesPorBultoDe(l.producto)
  const precio = precioServidor(l.producto)
  if (m > 1 && l.cantidad % m === 0) {
    const bultos = l.cantidad / m
    return `${mostrarNumero(bultos)} ${bultos === 1 ? 'bulto' : 'bultos'} × ${mostrarNumero(m)} = ${mostrarNumero(l.cantidad)} u`
  }
  return `${mostrarNumero(l.cantidad)} u × ${formatImporte(precio)}`
}

/**
 * Pasos 3 y 4 de la venta (lámina Carrito, S5/S6/S7). Paso 3, 'carrito': solo las líneas con el stock vuelto a chequear al abrir,
 * lo que cambió desde que se cargó marcado (el banner lo cuenta), el descuento general y "Continuar". Paso 4, 'entrega': la entrega y la
 * factura (`ajustes`), el aviso de autorización, el total y "Confirmar venta", que vuelve a chequear el stock y manda la venta
 * (no hay segunda confirmación). Si falta stock no se bloquea: el flujo de confirmar pide el motivo y la venta va a autorización.
 */
export function RevisarVenta({ paso, onContinuar, onVolverAlCarrito, cliente, descuentoGeneral, flete = 0, entrega, enviando, error, onConfirmar, deshabilitado = false, motivoDeshabilitado, onEditarLinea, onElegirFragancias, ajustes, autorizacion = [], onEditarProductos, yaReservadas, sinEncabezado = false, etiquetaConfirmar = 'Confirmar venta' }: Props) {
  const c = useColors()
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const { lineas, cambios, confirmado, sinConexion, revalidando, revalidar } = useRevalidarStockVenta()
  // Sin cantidades: el servidor dice, por producto, si lo pedido alcanza (sí/no, nunca el número). Al editar no se
  // consulta: el `disponible` ya descuenta lo que esta venta reservó y daría un falso "no alcanza".
  const alcanza = useAlcanzaStock(lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })), !yaReservadas)
  const [confirmando, setConfirmando] = useState(false)
  // El estado no alcanza como guardia: dos toques antes del re-render leen el mismo `confirmando`.
  const enCurso = useRef(false)
  const t = totalesEstimados(lineas, descuentoGeneral, flete)
  const lista = lineas.reduce((a, l) => a + l.producto.precioVenta * l.cantidad, 0)
  const ofertas = lista - t.subtotal
  // Los productos con sus descuentos, sin el flete: lo que cierra el carrito antes de la entrega.
  const productos = totalesEstimados(lineas, descuentoGeneral).total
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  const confirmar = async () => {
    // El stock se vuelve a chequear justo antes: confirmar decide con lo que haya en ese momento.
    // Sin señal `revalidar` vuelve enseguida (no espera a la red) y la venta sigue a la cola sin señal.
    if (enCurso.current) return
    enCurso.current = true
    setConfirmando(true)
    try {
      try {
        await revalidar()
      } finally {
        setConfirmando(false)
      }
      await onConfirmar()
    } finally {
      enCurso.current = false
    }
  }

  function estadoDeStock(l: LineaCarrito, cambio: boolean): { texto: string; alerta: boolean } {
    if (sinConexion) return { texto: 'Sin conexión: el stock se revisa al enviar', alerta: false }
    if (!confirmado) return { texto: revalidando ? 'Revisando el stock…' : 'No se pudo confirmar el stock', alerta: !revalidando }
    if (faltaStock(l, verCantidades, yaReservadas)) {
      return { alerta: true, texto: verCantidades ? `Quedan ${mostrarNumero(Math.max(disponibleParaLinea(l, yaReservadas), 0))}, pediste ${mostrarNumero(l.cantidad)}: tocá para ajustar` : 'Sin stock ahora: tocá para ajustar' }
    }
    if (cambio) return { alerta: false, texto: verCantidades ? `Stock actualizado: quedan ${mostrarNumero(disponibleParaLinea(l, yaReservadas))}` : 'Hay stock ahora' }
    if (alcanza.noAlcanzan.has(l.productoId)) return { alerta: true, texto: 'No alcanza el stock, va a pedir autorización' }
    if (alcanza.revisando) return { alerta: false, texto: 'Revisando el stock…' }
    return { alerta: false, texto: 'Stock confirmado ahora' }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        {sinEncabezado || paso !== 'carrito' ? null : <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Revisar venta</Text>}
        {cliente && !sinEncabezado && paso === 'carrito' ? (
          <View style={{ gap: 2 }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
            {nombreDelCliente(cliente) ? <Text style={secundario}>{nombreDelCliente(cliente)}</Text> : null}
          </View>
        ) : null}
        {cambios.length > 0 ? (
          <Notice tone="advertencia" testID="revisar-banner-stock">
            {`El stock cambió mientras cargabas: revisá ${cambios.length} ${cambios.length === 1 ? 'producto' : 'productos'}.`}
          </Notice>
        ) : null}
        {paso === 'entrega' && onVolverAlCarrito && !error ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver al carrito" onPress={onVolverAlCarrito} android_ripple={{ color: c.border }}
            style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ArrowLeft size={16} color={c.textSecondary} />
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.textSecondary }}>Volver al carrito</Text>
          </Pressable>
        ) : null}
        {paso === 'carrito' && error ? <Notice tone="peligro" testID="carrito-error">{error}</Notice> : null}
        {paso === 'entrega' && autorizacion.length > 0 ? (
          <Notice tone="advertencia" title="Esta venta necesita autorización" testID="revisar-autorizacion">
            {`${autorizacion.map((m) => `• ${m.charAt(0).toUpperCase()}${m.slice(1)}.`).join('\n')}\nPodés confirmarla igual: queda en Por autorizar.`}
          </Notice>
        ) : null}
        {paso === 'carrito' ? (
        <View style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: space[3], paddingBottom: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Productos</Text>
          {onEditarProductos ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Editar productos" onPress={onEditarProductos} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Editar</Text>
            </Pressable>
          ) : null}
        </View>
        {lineas.map((l, i) => {
          const padreId = l.producto.productoPadreId
          // Una sola vez por producto padre: sus variantes se reparten juntas en `FraganciasSheet`.
          const ofreceFragancias = !!onElegirFragancias && !!padreId && lineas.findIndex((x) => x.producto.productoPadreId === padreId) === i
          const cambio = cambios.some((x) => x.productoId === l.productoId)
          const { texto, alerta } = estadoDeStock(l, cambio)
          const color = alerta ? c.chip.porAutorizar.text : c.chip.entregado.text
          return (
            <View
              key={l.productoId}
              testID={cambio ? `linea-cambio-${l.productoId}` : undefined}
              style={{ paddingVertical: space[3], paddingHorizontal: space[2], borderRadius: radii.campo, gap: space[1], borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, ...(cambio ? { borderWidth: 2, borderColor: c.chip.porAutorizar.text } : null) }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Ajustar cantidad y oferta"
                onPress={() => onEditarLinea(l)}
                style={{ gap: space[1] }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <View style={{ flex: 1 }}>
                    <ProductoIdentidad nombre={l.producto.nombre} marca={l.producto.marca} codigo={l.producto.codigoPropio} lineasNombre={3} />
                  </View>
                  <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(subtotalLinea(l))}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Text style={{ ...secundario, ...importe }}>{detalleDe(l)}</Text>
                  {l.descuentoPct > 0 ? (
                    <View style={{ paddingHorizontal: space[2], borderRadius: radii.campo, backgroundColor: c.brandSoft }}>
                      <Text style={{ ...typeScale.secundario, color: c.brandInk }}>{`−${mostrarNumero(l.descuentoPct)} %`}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <Text style={{ ...typeScale.secundario, color }}>{texto}</Text>
                </View>
              </Pressable>
              {ofreceFragancias ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Elegir fragancias de ${l.producto.nombre.split(' - ')[0]}`} onPress={() => onElegirFragancias?.(padreId!)}
                  style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Elegir fragancias</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
        </View>
        ) : null}
        {ajustes}
        <View style={{ gap: space[2], paddingTop: space[2] }}>
          {paso === 'carrito' ? (
            <>
              <TotalsRow label="Subtotal de lista" importe={lista} />
              {ofertas > 0 ? <TotalsRow label="Descuentos de línea" importe={-ofertas} /> : null}
              {t.descuento > 0 ? <TotalsRow label="Descuento general" importe={-t.descuento} /> : null}
            </>
          ) : (
            <>
              <TotalsRow label="Total de productos" importe={productos} />
              {flete > 0 ? <TotalsRow label="Flete (logística propia)" importe={flete} /> : null}
            </>
          )}
          {entrega ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={secundario}>Entrega</Text>
              <Text style={secundario}>{entrega}</Text>
            </View>
          ) : null}
          <Text style={secundario}>Los totales son estimados: el total final lo calcula el sistema al guardar.</Text>
        </View>
      </ScrollView>
      {paso === 'carrito' ? (
        <PieFijo fondo="bg">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={secundario}>Total de productos</Text>
            <Text testID="carrito-paso-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(productos)}</Text>
          </View>
          <Button label="Continuar" iconoFinal={ChevronRight} onPress={() => onContinuar?.()} disabled={lineas.length === 0} />
          {lineas.length === 0 ? <MotivoDeshabilitado>Agregá al menos un producto para seguir.</MotivoDeshabilitado> : null}
        </PieFijo>
      ) : (
        <PieFijo fondo="bg">
          {error ? (
            <>
              <Notice tone="peligro">{error}</Notice>
              {onVolverAlCarrito ? <Button label="Volver al carrito" variant="secundario" onPress={onVolverAlCarrito} /> : null}
            </>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={secundario}>Total estimado</Text>
            <Text testID="revisar-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(t.total)}</Text>
          </View>
          <Button label={etiquetaConfirmar} onPress={() => { void confirmar() }} loading={enviando || confirmando} disabled={enviando || confirmando || deshabilitado || lineas.length === 0} />
          {motivoDeshabilitado ? <MotivoDeshabilitado>{motivoDeshabilitado}</MotivoDeshabilitado> : null}
        </PieFijo>
      )}
    </View>
  )
}
