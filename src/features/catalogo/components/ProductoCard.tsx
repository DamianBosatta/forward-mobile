import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import { getFullImageUrl } from '@/libs/api-client/media'
import { chipDeTarjeta, detalleDeTarjeta, textoVariacion, type ProductoDeTarjeta } from '../lib/presentacion'

interface ProductoCardProps {
  producto: ProductoDeTarjeta
  /** Lo decide el servidor; undefined = sin dato (líneas o sin depósito): sin chip. */
  disponible?: boolean
  grilla?: boolean
  seleccionado?: boolean
  onPress: () => void
}

/**
 * Tarjeta del catálogo de consulta (lámina CatalogoConsulta): foto, código, chip, nombre y precio de lista. El chip lleva
 * el color de la novedad (verde nuevo, ámbar precio nuevo, rojo sin stock) y un precio que cambió muestra la variación.
 */
export function ProductoCard({ producto, disponible, grilla, seleccionado, onPress }: ProductoCardProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const chip = chipDeTarjeta(producto.novedad, disponible)
  const variacion = textoVariacion(producto.variacionPorcentaje)
  const sinStock = producto.novedad === 'SinStock'
  const conNovedad = !!producto.novedad && producto.novedad !== 'Ninguna'
  const detalle = detalleDeTarjeta(producto)
  const foto = getFullImageUrl(producto.imageUrl)
  const ladoFoto = grilla ? undefined : 72

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[`${producto.nombre}, código ${producto.codigoPropio}`, conNovedad ? chip?.label : null, variacion].filter(Boolean).join(', ')}
      accessibilityState={{ selected: !!seleccionado }}
      // Estilo fijo y no una función de `pressed`: con NativeWind 4 la función se pierde (sin fila en la lista ni
      // flex en la grilla). El toque se marca con el ripple nativo.
      android_ripple={{ color: c.surface2 }}
      style={{
        flex: grilla ? 1 : undefined,
        flexDirection: grilla ? 'column' : 'row',
        gap: space[3],
        padding: space[3],
        borderRadius: radii.tarjeta,
        backgroundColor: seleccionado ? c.brandSoft : c.surface,
        borderWidth: 2,
        borderColor: seleccionado ? c.brand : c.surface,
        ...sombra,
      }}
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
        {/* wrap + marginLeft auto: en la grilla el importe baja de renglón y queda a la derecha. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[2] }}>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Precio de lista</Text>
          <Text style={[typeScale.cuerpoDestacado, importe, { marginLeft: 'auto', color: sinStock ? c.textSecondary : c.text }]}>{formatImporte(producto.precioVenta)}</Text>
        </View>
        {variacion ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: space[2] }}>
            {producto.precioAnterior != null ? (
              <Text style={[typeScale.secundario, importe, { color: c.textSecondary, textDecorationLine: 'line-through' }]}>
                {formatImporte(producto.precioAnterior)}
              </Text>
            ) : null}
            <Text style={[typeScale.etiqueta, { color: c.chip.porAutorizar.text }]}>{variacion}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
