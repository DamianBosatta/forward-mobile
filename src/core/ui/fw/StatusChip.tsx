import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors, type ChipEstado } from '@/libs/theme'
import { CHIP_LABEL } from './estadoChip'

interface StatusChipProps {
  estado: ChipEstado
  /** Texto del chip; por defecto, el nombre del estado. */
  label?: string
}

/** Chip de estado de la lámina F4: el mismo en todas las pantallas. */
export function StatusChip({ estado, label = CHIP_LABEL[estado] }: StatusChipProps) {
  const { bg, text } = useColors().chip[estado]
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${label}`}
      style={{
        flexShrink: 0,
        backgroundColor: bg,
        borderRadius: radii.pastilla,
        paddingVertical: space[1],
        paddingHorizontal: 10, // lámina F4: 4 × 10
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[typeScale.etiqueta, { color: text }]}>{label}</Text>
    </View>
  )
}
