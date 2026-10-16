import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors, type ForwardColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { CatalogoStockItem } from '@/libs/api-client'
import { leyendaMultiplo, precioServidor } from '../lib/carrito'

interface ProductoCatalogoCardProps {
  producto: CatalogoStockItem
  /** Cantidad en el carrito (0 = no está). */
  cantidad: number
  /** Ve cantidades de stock (capacidad CAP_VER_CANTIDADES_STOCK); si no, solo "Hay stock / Sin stock". */
  verCantidades: boolean
  onAgregar: () => void
  onSumar: () => void
  onRestar: () => void
  onElegirFragancias?: () => void
  /** Abre "Editar línea" (descuento y detalle); solo cuando ya está en el carrito. */
  onEditar?: () => void
}

/** Tarjeta del catálogo de venta (lámina Catalogo): foto, código, disponibilidad, precio y "+ Añadir". */
export function ProductoCatalogoCard({
  producto: p, cantidad, verCantidades, onAgregar, onSumar, onRestar, onElegirFragancias, onEditar,
}: ProductoCatalogoCardProps) {
  const c = useColors()
  const stock = c.chip[p.puedeVenderse ? 'entregado' : 'anulado'].text
  const leyenda = leyendaMultiplo(p)

  return (
    <View
      testID={`producto-${p.id}`}
      style={{
        flex: 1, flexDirection: 'row', gap: space[3], padding: space[3], borderRadius: radii.tarjeta,
        backgroundColor: c.surface, borderWidth: 2, borderColor: cantidad > 0 ? c.brand : c.surface,
      }}
    >
      <View style={{ width: 72, height: 72, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.imageUrl ? (
          <Image source={{ uri: p.imageUrl }} style={{ width: 72, height: 72 }} accessibilityIgnoresInvertColors />
        ) : (
          <Package size={32} color={c.textSecondary} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{p.codigoPropio ?? ''}</Text>
          <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: stock }}>
            {verCantidades ? `Stock: ${p.real}` : p.puedeVenderse ? 'Hay stock' : 'Sin stock'}
          </Text>
        </View>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{p.nombre}</Text>
        {leyenda && <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{leyenda}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(precioServidor(p))}</Text>
          {p.esPadreDeVariantes ? (
            <Accion c={c} label="Elegir fragancias" onPress={onElegirFragancias} />
          ) : cantidad > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Redondo c={c} label="−" a11y={`Restar ${p.nombre}`} onPress={onRestar} />
              <Text accessibilityLabel={`Cantidad: ${cantidad}`} style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, minWidth: 32, textAlign: 'center' }}>
                {cantidad}
              </Text>
              <Redondo c={c} label="+" a11y={`Sumar ${p.nombre}`} onPress={onSumar} />
            </View>
          ) : (
            <Accion c={c} label="+ Añadir" a11y={`Añadir ${p.nombre}`} onPress={onAgregar} />
          )}
        </View>
        {cantidad > 0 && onEditar && (
          <Pressable accessibilityRole="link" onPress={onEditar} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.brandInk }}>
              Descuento y detalle de la línea
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function Accion({ c, label, a11y, onPress }: { c: ForwardColors; label: string; a11y?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space[4], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center' }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

export function Redondo({ c, label, a11y, onPress, disabled = false }: { c: ForwardColors; label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ ...typeScale.titulo, color: disabled ? c.textSecondary : c.text }}>{label}</Text>
    </Pressable>
  )
}
