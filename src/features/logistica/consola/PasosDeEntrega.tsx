import React from 'react'
import { View } from 'react-native'
import { radii, space, useColors } from '@/libs/theme'

interface Props {
  /** Paso actual, desde 1. */
  numero: number
  total: number
}

/**
 * Los pasos de la entrega como segmentos bajo la barra superior (chofer-03 a chofer-05): hechos en teal, el actual en ink
 * y los que faltan en `surfaceAlt`. Es un refuerzo visual: "Paso N de M" ya está escrito en el subtítulo de la barra.
 */
export function PasosDeEntrega({ numero, total }: Props) {
  const c = useColors()
  return (
    <View
      testID="pasos-de-entrega"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[1] }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 10, borderRadius: radii.pastilla, backgroundColor: i + 1 < numero ? c.teal : i + 1 === numero ? c.ink : c.surfaceAlt }}
        />
      ))}
    </View>
  )
}
