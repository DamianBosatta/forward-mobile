import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { direccionDeEntrega, nombreDelCliente, type ClienteNombrable } from '@/features/clientes/lib/cliente'
import { useRevalidarStockVenta } from '../hooks/useRevalidarStockVenta'
import { multiploDe, precioServidor, subtotalLinea, type LineaCarrito } from '../lib/carrito'
import { faltaStock, totalesEstimados } from '../lib/avisos'
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
  /** Confirmar: el flujo existente (`useConfirmarVenta().confirmar`), que pide el motivo si falta stock. */
  onConfirmar: () => void | Promise<void>
  /** Tocar una línea: abre la pantalla de cantidad y oferta. */
  onEditarLinea: (linea: LineaCarrito) => void
}

/** "2 bultos × $ 1.720,50" si la cantidad es de cajas cerradas; si no, "4 u × $ 400,56". */
function detalleDe(l: LineaCarrito): string {
  const m = multiploDe(l.producto)
  const precio = precioServidor(l.producto)
  if (m > 1 && l.cantidad % m === 0) {
    const bultos = l.cantidad / m
    return `${mostrarNumero(bultos)} ${bultos === 1 ? 'bulto' : 'bultos'} × ${formatImporte(precio * m)}`
  }
  return `${mostrarNumero(l.cantidad)} u × ${formatImporte(precio)}`
}

/**
 * Revisar y confirmar (lámina Carrito, S5/S6/S7): las líneas con el stock vuelto a chequear al abrir y otra vez al
 * tocar "Confirmar venta"; lo que cambió desde que se cargó queda marcado y el banner lo cuenta. Si falta stock
 * no se bloquea: el flujo de confirmar pide el motivo y la venta va a autorización.
 */
export function RevisarVenta({ cliente, descuentoGeneral, flete = 0, entrega, enviando, error, onConfirmar, onEditarLinea }: Props) {
  const c = useColors()
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const { lineas, cambios, confirmado, revalidando, revalidar } = useRevalidarStockVenta()
  const t = totalesEstimados(lineas, descuentoGeneral, flete)
  const lista = lineas.reduce((a, l) => a + l.producto.precioVenta * l.cantidad, 0)
  const ofertas = lista - t.subtotal
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  const confirmar = async () => {
    // El stock se vuelve a chequear justo antes: confirmar decide con lo que haya en ese momento.
    await revalidar()
    await onConfirmar()
  }

  function estadoDeStock(l: LineaCarrito, cambio: boolean): { texto: string; alerta: boolean } {
    if (!confirmado) return { texto: revalidando ? 'Revisando el stock…' : 'No se pudo confirmar el stock', alerta: !revalidando }
    if (faltaStock(l, verCantidades)) {
      return { alerta: true, texto: verCantidades ? `Quedan ${mostrarNumero(Math.max(l.producto.disponible, 0))}, pediste ${mostrarNumero(l.cantidad)}: tocá para ajustar` : 'Sin stock ahora: tocá para ajustar' }
    }
    if (cambio) return { alerta: false, texto: verCantidades ? `Stock actualizado: quedan ${mostrarNumero(l.producto.disponible)}` : 'Hay stock ahora' }
    return { alerta: false, texto: 'Stock confirmado ahora' }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Revisar venta</Text>
        {cliente ? (
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
        {lineas.map((l) => {
          const cambio = cambios.some((x) => x.productoId === l.productoId)
          const { texto, alerta } = estadoDeStock(l, cambio)
          const color = alerta ? c.chip.porAutorizar.text : c.chip.entregado.text
          return (
            <Pressable
              key={l.productoId}
              testID={cambio ? `linea-cambio-${l.productoId}` : undefined}
              accessibilityRole="button"
              accessibilityHint="Ajustar cantidad y oferta"
              onPress={() => onEditarLinea(l)}
              style={{ padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[1], borderWidth: 2, borderColor: cambio ? c.chip.porAutorizar.text : c.surface }}
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
          )
        })}
        <View style={{ gap: space[2], paddingTop: space[2] }}>
          <TotalsRow label="Subtotal de lista" importe={lista} />
          {ofertas > 0 ? <TotalsRow label="Ofertas" importe={-ofertas} /> : null}
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
        <Button label="Confirmar venta" onPress={() => { void confirmar() }} loading={enviando} disabled={enviando || lineas.length === 0} />
      </View>
    </View>
  )
}
