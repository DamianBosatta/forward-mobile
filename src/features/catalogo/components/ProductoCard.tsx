import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import { getFullImageUrl } from '@/libs/api-client/media'
import type { Producto } from '@/libs/api-client/types'
import { chipDeStock, detalleDeTarjeta } from '../lib/presentacion'

interface ProductoCardProps {
  producto: Producto
  /** Lo decide el servidor (`hayDisponible` del listado o la consulta de disponibilidad); undefined = sin dato: sin chip. */
  disponible?: boolean
  grilla?: boolean
  seleccionado?: boolean
  onPress: () => void
}

/** Tarjeta del catálogo de consulta (lámina CatalogoConsulta): foto, código, chip, nombre y precio de lista. */
export function ProductoCard({ producto, disponible, grilla, seleccionado, onPress }: ProductoCardProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const chip = chipDeStock(disponible)
  const detalle = detalleDeTarjeta(producto)
  const foto = getFullImageUrl(producto.imageUrl)
  const ladoFoto = grilla ? undefined : 72

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${producto.nombre}, código ${producto.codigoPropio}`}
      accessibilityState={{ selected: !!seleccionado }}
      style={({ pressed }) => ({
        flex: grilla ? 1 : undefined,
        flexDirection: grilla ? 'column' : 'row',
        gap: space[3],
        padding: space[3],
        borderRadius: radii.tarjeta,
        backgroundColor: seleccionado ? c.brandSoft : c.surface,
        borderWidth: 2,
        borderColor: seleccionado ? c.brand : c.surface,
        opacity: pressed ? 0.85 : 1,
        ...sombra,
      })}
    >
      <View
        style={{
          width: ladoFoto,
          height: grilla ? 120 : 72,
          borderRadius: radii.campo,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Package size={32} color={c.textSecondary} strokeWidth={1.6} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>
            {producto.codigoPropio}
          </Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
        <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: c.text }]}>
          {producto.nombre}
        </Text>
        {detalle ? <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{detalle}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Precio de lista</Text>
          <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(producto.precioVenta)}</Text>
        </View>
      </View>
    </Pressable>
  )
}
