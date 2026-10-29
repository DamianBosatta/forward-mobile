import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ShoppingCart } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors } from '@/libs/theme'
import { Button, formatImporte } from '@/core/ui/fw'
import { precioServidor, resumenCarrito, subtotalLinea, totalEstimado, type LineaCarrito } from '../lib/carrito'

interface CarritoProps {
  lineas: LineaCarrito[]
  onVerVenta: () => void
}

const ROTULO = 'Total estimado'

/** Teléfono: barra fija abajo con el total estimado, productos y bultos, y "Ver venta" (lámina CalleCatalogo). */
export function CarritoFlotante({ lineas, onVerVenta }: CarritoProps) {
  const c = useColors()
  // La lámina la dibuja siempre: sin productos queda en 0 y "Ver venta" no responde.
  const vacio = lineas.length === 0
  const total = formatImporte(totalEstimado(lineas))
  return (
    <View testID="carrito-barra" style={{ paddingHorizontal: space[3], paddingTop: space[3], paddingBottom: space[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver venta: ${lineas.length} ítems, ${ROTULO.toLowerCase()} ${total}`}
        disabled={vacio}
        accessibilityState={{ disabled: vacio }}
        onPress={onVerVenta}
        style={{ opacity: vacio ? 0.6 : 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingLeft: space[4], paddingRight: space[2], borderRadius: radii.tarjeta, backgroundColor: c.action }}
      >
        <View>
          <ShoppingCart size={24} color={c.onAction} />
          <View style={{ position: 'absolute', top: -8, right: -10, paddingHorizontal: 6, borderRadius: radii.pastilla, backgroundColor: c.bg }}>
            <Text testID="carrito-items" style={{ ...typeScale.etiqueta, color: c.action }}>{lineas.length}</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: space[2] }}>
          <Text testID="carrito-total" style={{ ...typeScale.titulo, ...importe, color: c.onAction }}>{total}</Text>
          <Text style={{ ...typeScale.secundario, color: c.onAction }}>{resumenCarrito(lineas)}</Text>
        </View>
        <View style={{ minHeight: 44, paddingHorizontal: space[4], justifyContent: 'center', borderRadius: radii.campo, backgroundColor: c.bg }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.action }}>Ver venta</Text>
        </View>
      </Pressable>
    </View>
  )
}

/** Tablet horizontal: carrito fijo a la derecha con las líneas y el total estimado (lámina TabCatalogo). */
export function CarritoPanel({ lineas, onVerVenta }: CarritoProps) {
  const c = useColors()
  return (
    <View testID="carrito-panel" style={{ width: 360, borderLeftWidth: 1, borderLeftColor: c.border, backgroundColor: c.surface, padding: space[4], gap: space[3] }}>
      <Text style={{ ...typeScale.seccion, color: c.text }}>{`Venta · ${lineas.length} ítems`}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space[3] }}>
        {lineas.length === 0 && <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no agregaste productos.</Text>}
        {lineas.map((l) => (
          <View key={l.productoId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{l.producto.nombre}</Text>
              <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>
                {`${l.cantidad} × ${formatImporte(precioServidor(l.producto))}`}
              </Text>
            </View>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(subtotalLinea(l))}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{ROTULO}</Text>
        <Text testID="carrito-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(totalEstimado(lineas))}</Text>
      </View>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>El total final lo calcula el sistema al guardar.</Text>
      <Button label="Ver venta" onPress={onVerVenta} disabled={lineas.length === 0} />
    </View>
  )
}
