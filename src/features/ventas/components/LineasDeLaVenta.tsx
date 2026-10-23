import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { VentaDetalleDto } from '@/libs/api-client/types'
import { agruparPorPadre, nombreFragancia } from '@/features/venta-nueva/lib/fragancias'
import { mostrarNumero } from '@/features/venta-nueva/lib/linea'

/**
 * Las líneas de la venta (lámina ResVentaDetalle): producto, "cantidad × precio" y subtotal. Las fragancias de
 * una línea van juntas ("16 · Lavanda 6, Coco 6, Brisa 4"); el descuento de la línea se dice solo si lo hay.
 */
export function LineasDeLaVenta({ detalles }: { detalles: VentaDetalleDto['detalles'] }) {
  const c = useColors()
  const sec = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
      {agruparPorPadre(detalles, (d) => d.productoPadreId).map((g, i) => {
        const items = g.tipo === 'producto' ? [g.item] : g.items
        const padre = g.tipo === 'fragancias' ? (items[0]!.productoPadreNombre ?? items[0]!.productoNombre.split(' - ')[0]!) : null
        const unidades = items.reduce((a, d) => a + d.cantidad, 0)
        const precio = items.every((d) => d.precioUnitario === items[0]!.precioUnitario) ? items[0]!.precioUnitario : null
        const desc = items.every((d) => d.porcentajeDescuentoItem === items[0]!.porcentajeDescuentoItem) ? items[0]!.porcentajeDescuentoItem : null
        const partes = padre
          ? `${unidades} · ${items.map((d) => `${nombreFragancia({ nombre: d.productoNombre }, padre)} ${d.cantidad}`).join(', ')}`
          : precio !== null ? `${unidades} × ${formatImporte(precio)}` : `${unidades} unidades`
        return (
          <View
            key={g.tipo === 'producto' ? g.item.id : g.padreId}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2], padding: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{padre ?? items[0]!.productoNombre}</Text>
              <Text style={{ ...sec, ...importe }}>{desc ? `${partes} · −${mostrarNumero(desc)} %` : partes}</Text>
            </View>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(items.reduce((a, d) => a + d.subtotal, 0))}</Text>
          </View>
        )
      })}
    </View>
  )
}
