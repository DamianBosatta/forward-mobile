import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  label: string
  activo: boolean
  onPress: () => void
  /** 'button' (por defecto): filtro que se prende y apaga; 'radio': uno de un grupo excluyente. */
  rol?: 'button' | 'radio'
  /** Lo que oye el lector, si no es el mismo texto. */
  accessibilityLabel?: string
}

/**
 * Chip de filtro de 44 px con tilde cuando está activo (propuesta "Finanzas como venta", frames 1 y 16:
 * "Con deuda vencida" en Cuentas y los motivos de Autorizaciones). El de `fw` (FiltroChip) mide 36 y no lleva tilde.
 */
export function ChipDeFiltro({ label, activo, onPress, rol = 'button', accessibilityLabel }: Props) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole={rol}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={rol === 'radio' ? { selected: activo, checked: activo } : { selected: activo }}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[4],
        borderRadius: radii.pastilla,
        borderWidth: activo ? 2 : 1,
        borderColor: activo ? c.brand : c.border,
        backgroundColor: activo ? c.brandSoft : c.surface,
      }}
    >
      {activo ? (
        <View testID="chip-tilde">
          <Check size={18} color={c.brandInk} strokeWidth={2.5} />
        </View>
      ) : null}
      <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.secundario, { color: activo ? c.brandInk : c.text }, activo ? { fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600' } : null]}>
        {label}
      </Text>
    </Pressable>
  )
}
