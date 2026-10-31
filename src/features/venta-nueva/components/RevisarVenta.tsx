import React, { useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { direccionDeEntrega, nombreDelCliente, type ClienteNombrable } from '@/features/clientes/lib/cliente'
import { useRevalidarStockVenta } from '../hooks/useRevalidarStockVenta'
import { precioServidor, subtotalLinea, unidadesPorBultoDe, type LineaCarrito } from '../lib/carrito'
import { disponibleParaLinea, faltaStock, totalesEstimados, type YaReservadas } from '../lib/avisos'
import { mostrarNumero } from '../lib/linea'

interface Props {
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
 * Revisar y confirmar (lámina Carrito, S5/S6/S7): las líneas con el stock vuelto a chequear al abrir y otra vez al
 * tocar "Confirmar venta" (que manda la venta: no hay segunda confirmación); lo que cambió desde que se cargó queda marcado y el banner lo cuenta. Si falta stock
 * no se bloquea: el flujo de confirmar pide el motivo y la venta va a autorización.
 */
export function RevisarVenta({ cliente, descuentoGeneral, flete = 0, entrega, enviando, error, onConfirmar, deshabilitado = false, motivoDeshabilitado, onEditarLinea, onElegirFragancias, ajustes, autorizacion = [], onEditarProductos, yaReservadas, sinEncabezado = false, etiquetaConfirmar = 'Confirmar venta' }: Props) {
  const c = useColors()
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const { lineas, cambios, confirmado, sinConexion, revalidando, revalidar } = useRevalidarStockVenta()
  const [confirmando, setConfirmando] = useState(false)
  // El estado no alcanza como guardia: dos toques antes del re-render leen el mismo `confirmando`.
  const enCurso = useRef(false)
  const t = totalesEstimados(lineas, descuentoGeneral, flete)
  const lista = lineas.reduce((a, l) => a + l.producto.precioVenta * l.cantidad, 0)
  const ofertas = lista - t.subtotal
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
    return { alerta: false, texto: 'Stock confirmado ahora' }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        {sinEncabezado ? null : <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Revisar venta</Text>}
        {cliente && !sinEncabezado ? (
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
        {autorizacion.length > 0 ? (
          <Notice tone="advertencia" title="Esta venta necesita autorización" testID="revisar-autorizacion">
            {`${autorizacion.map((m) => `• ${m.charAt(0).toUpperCase()}${m.slice(1)}.`).join('\n')}\nPodés confirmarla igual: queda en Por autorizar.`}
          </Notice>
        ) : null}
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
                {l.producto.marca ? <Text style={secundario}>{l.producto.marca}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{l.producto.nombre}</Text>
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
        {ajustes}
        <View style={{ gap: space[2], paddingTop: space[2] }}>
          <TotalsRow label="Subtotal de lista" importe={lista} />
          {ofertas > 0 ? <TotalsRow label="Descuentos de línea" importe={-ofertas} /> : null}
          {t.descuento > 0 ? <TotalsRow label="Descuento general" importe={-t.descuento} /> : null}
          {flete > 0 ? <TotalsRow label="Flete (logística propia)" importe={flete} /> : null}
          {entrega ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={secundario}>Entrega</Text>
              <Text style={secundario}>{entrega}</Text>
            </View>
          ) : null}
          <Text style={secundario}>Los totales son estimados: el total final lo calcula el sistema al guardar.</Text>
        </View>
      </ScrollView>
      <View style={{ padding: space[4], gap: space[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg }}>
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={secundario}>Total estimado</Text>
          <Text testID="revisar-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(t.total)}</Text>
        </View>
        <Button label={etiquetaConfirmar} onPress={() => { void confirmar() }} loading={enviando || confirmando} disabled={enviando || confirmando || deshabilitado || lineas.length === 0} />
        {motivoDeshabilitado ? <MotivoDeshabilitado>{motivoDeshabilitado}</MotivoDeshabilitado> : null}
      </View>
    </View>
  )
}
