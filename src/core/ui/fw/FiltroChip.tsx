import React from 'react'
import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from './PressableFx'

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
  /** Etiqueta en una sola línea (por defecto no: el texto puede partirse). Para filtros de etiqueta corta junto a otros. */
  unaLinea?: boolean
}

/** Chip de filtro y de opción de formularios (44 pt, píldora): activo = botón principal con tilde, inactivo = `surface2` (P10) sin borde. */
export function FiltroChip({ label, activo, onPress, oscuro = false, rol = 'button', accessibilityLabel, conTilde = true, unaLinea = false }: FiltroChipProps) {
  const c = useColors()
  return (
    <PressableFx
      onPress={onPress}
      accessibilityRole={rol}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={rol === 'button' ? { selected: activo } : { selected: activo, checked: activo }}
      android_ripple={{ color: oscuro ? c.topBarBorder : c.surfaceAlt }}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
        paddingHorizontal: space[4],
        borderRadius: radii.pastilla,
        ...(oscuro ? { borderWidth: 1, borderColor: activo ? c.primaryBg : c.topBarBorder } : null),
        backgroundColor: oscuro ? (activo ? c.primaryBg : 'transparent') : activo ? c.primaryBg : c.surface2,
      }}
    >
      {activo && !oscuro && conTilde ? <View testID="chip-tilde"><Check size={16} color={c.primaryFg} strokeWidth={2.5} /></View> : null}
      <Text maxFontSizeMultiplier={maxFontScale} numberOfLines={unaLinea ? 1 : undefined} style={[typeScale.etiquetaChip, { color: oscuro ? (activo ? c.primaryFg : c.onTopBarStrong) : activo ? c.primaryFg : c.text }]}>{label}</Text>
    </PressableFx>
  )
}
