import React from 'react'
import { Text, View, type TextStyle } from 'react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

export interface ProductoIdentidadProps {
  nombre: string
  marca?: string | null
  /** Código propio ("nro. de artículo"). */
  codigo?: string | null
  /** Cuántos renglones puede ocupar el nombre (por defecto 2). */
  lineasNombre?: number
  /** Estilo del nombre; por defecto el de nombres de fila (`cuerpoDestacado`). */
  estiloNombre?: TextStyle
}

/**
 * Identidad de un producto en cualquier fila (S2/S3): la marca chica arriba, el nombre y el código propio como
 * insignia al lado del nombre. Sin marca no hay renglón de marca; sin código no hay insignia. Es la única
 * convención de la app: no se arma a mano en cada pantalla (web: `ProductoIdentidad` de `@forward/ui`).
 */
export function ProductoIdentidad({ nombre, marca, codigo, lineasNombre = 2, estiloNombre }: ProductoIdentidadProps) {
  const c = useColors()
  const marcaLimpia = marca?.trim()
  const codigoLimpio = codigo?.trim()
  return (
    <View style={{ flexShrink: 1, minWidth: 0, gap: space[1] }}>
      {marcaLimpia ? (
        <Text numberOfLines={1} style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
          {marcaLimpia}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', columnGap: space[2], rowGap: space[1] }}>
        <Text numberOfLines={lineasNombre} style={[typeScale.cuerpoDestacado, { color: c.text, flexShrink: 1 }, estiloNombre]}>
          {nombre}
        </Text>
        {codigoLimpio ? (
          <View
            accessibilityLabel={`Código ${codigoLimpio}`}
            style={{ backgroundColor: c.surface2, borderRadius: radii.pastilla, paddingHorizontal: space[2], paddingVertical: 2, alignSelf: 'flex-start' }}
          >
            <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.etiqueta, { color: c.textSecondary }]}>
              {codigoLimpio}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
