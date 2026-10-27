import React from 'react'
import { Pressable, Text } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface FiltroChipProps {
  label: string
  activo: boolean
  onPress: () => void
  /** Sobre un encabezado oscuro (barra superior): activo en color de acción, inactivo con borde tenue. */
  oscuro?: boolean
}

/** Chip de filtro de los lienzos de catálogo y stock (Hay stock, En alerta, depósito): activo en color de marca. */
export function FiltroChip({ label, activo, onPress, oscuro = false }: FiltroChipProps) {
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
        borderColor: oscuro ? (activo ? c.action : c.topBarBorder) : activo ? c.brand : c.border,
        backgroundColor: oscuro ? (activo ? c.action : 'transparent') : activo ? c.brandSoft : c.surface,
      }}
    >
      <Text style={[typeScale.secundario, { color: oscuro ? (activo ? c.onAction : c.onTopBarStrong) : activo ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}
