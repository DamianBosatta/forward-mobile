import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors, type ChipEstado } from '@/libs/theme'
import { CHIP_LABEL } from './estadoChip'

interface StatusChipProps {
  estado: ChipEstado
  /** Texto del chip; por defecto, el nombre del estado. */
  label?: string
}

/** Chip de estado FWD (spec §5): píldora de relleno pleno con texto `ink`, el mismo en todas las pantallas. El estado va siempre escrito. */
export function StatusChip({ estado, label = CHIP_LABEL[estado] }: StatusChipProps) {
  const { bg, text } = useColors().chipFill[estado]
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${label}`}
      style={{
        flexShrink: 0,
        backgroundColor: bg,
        borderRadius: radii.pastilla,
        height: 28,
        justifyContent: 'center',
        paddingHorizontal: space[3],
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[typeScale.etiqueta, { color: text }]}>{label}</Text>
    </View>
  )
}
