import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface FiltroChipProps {
  label: string
  activo: boolean
  onPress: () => void
  /** Sobre un encabezado oscuro (barra superior): activo en color de acción, inactivo con borde tenue. */
  oscuro?: boolean
  /** 'button' (por defecto): filtro que se prende y apaga; 'radio': uno de un grupo excluyente; 'checkbox': uno de varios. */
  rol?: 'button' | 'radio' | 'checkbox'
  /** Lo que oye el lector, si no es el mismo texto. */
  accessibilityLabel?: string
  /** Tilde delante del activo (por defecto sí: el color nunca va solo). */
  conTilde?: boolean
}

/** Chip de filtro y de opción de formularios (44 pt): activo en color de marca con tilde, inactivo con contorno `borderStrong`. */
export function FiltroChip({ label, activo, onPress, oscuro = false, rol = 'button', accessibilityLabel, conTilde = true }: FiltroChipProps) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={rol}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={rol === 'button' ? { selected: activo } : { selected: activo, checked: activo }}
      android_ripple={{ color: oscuro ? c.topBarBorder : c.surface2 }}
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
      {activo && !oscuro && conTilde ? <View testID="chip-tilde"><Check size={16} color={c.brandInk} strokeWidth={2.5} /></View> : null}
      <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.secundario, { color: oscuro ? (activo ? c.onAction : c.onTopBarStrong) : activo ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}
