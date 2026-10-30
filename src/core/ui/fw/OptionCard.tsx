import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  label: string
  /** Segunda línea ("Te dan plata, calculamos el vuelto"). */
  detail?: string
  icon?: LucideIcon
  selected?: boolean
  /** Alto mínimo: 76 para listas de opciones, 132 para el sí/no de una pregunta. */
  minHeight?: number
  disabled?: boolean
  onPress: () => void
  accessibilityLabel?: string
}

/**
 * Opción grande de la consola del chofer (lámina chofer-03/04): se toca con una mano y al sol. La elegida
 * lleva tilde y borde grueso, nunca solo color. Es un radio: el estado va en `accessibilityState.checked`.
 */
export function OptionCard({ label, detail, icon: Icono, selected = false, minHeight = 76, disabled = false, onPress, accessibilityLabel }: Props) {
  const c = useColors()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      style={{
        minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        borderRadius: radii.tarjeta,
        borderWidth: selected ? 3 : 2,
        borderColor: selected ? c.brandInk : c.textSecondary,
        backgroundColor: selected ? c.brandSoft : c.surface,
      }}
    >
      {Icono ? <Icono size={minHeight > 100 ? 40 : 28} color={selected ? c.brandInk : c.text} strokeWidth={2.5} /> : null}
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.seccion, fontSize: 19, lineHeight: 26, color: selected ? c.brandInk : c.text }}>{label}</Text>
        {detail ? <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.secundario, color: c.textSecondary }}>{detail}</Text> : null}
      </View>
      {selected ? <Check size={28} color={c.brandInk} strokeWidth={3} /> : null}
    </Pressable>
  )
}
