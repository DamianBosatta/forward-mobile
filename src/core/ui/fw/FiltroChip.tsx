import React from 'react'
import { Pressable, Text } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface FiltroChipProps {
  label: string
  activo: boolean
  onPress: () => void
}

/** Chip de filtro de los lienzos de catálogo y stock (Hay stock, En alerta, depósito): activo en color de marca. */
export function FiltroChip({ label, activo, onPress }: FiltroChipProps) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: activo }}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: space[3],
        borderRadius: radii.pastilla,
        borderWidth: 1,
        borderColor: activo ? c.brand : c.border,
        backgroundColor: activo ? c.brandSoft : c.surface,
      }}
    >
      <Text style={[typeScale.secundario, { color: activo ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}
