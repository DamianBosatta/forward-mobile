import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
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
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
        paddingHorizontal: space[3] - (activo && !oscuro ? 1 : 0),
        borderRadius: radii.pastilla,
        borderWidth: activo && !oscuro ? 2 : 1,
        borderColor: oscuro ? (activo ? c.action : c.topBarBorder) : activo ? c.brand : c.borderStrong,
        backgroundColor: oscuro ? (activo ? c.action : 'transparent') : activo ? c.brandSoft : c.surface,
      }}
    >
      {activo && !oscuro ? <View testID="chip-tilde"><Check size={16} color={c.brandInk} strokeWidth={2.5} /></View> : null}
      <Text style={[typeScale.secundario, { color: oscuro ? (activo ? c.onAction : c.onTopBarStrong) : activo ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}
