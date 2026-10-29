import React from 'react'
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'

interface FabProps {
  /** Obligatorio: el botón es solo un ícono. */
  accessibilityLabel: string
  onPress: () => void
  /** Texto junto al ícono ("Nueva venta"): el botón pasa a pastilla de 56 de alto, sin ancho fijo. */
  label?: string
  /** Por defecto, abajo a la derecha (16 / 24, como en la lámina). */
  style?: StyleProp<ViewStyle>
}

/** Botón flotante de la lámina F4: 56 px, color de acción y la única sombra. */
export function Fab({ accessibilityLabel, onPress, label, style }: FabProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: space[4],
          bottom: space[6],
          height: 56,
          ...(label ? { flexDirection: 'row' as const, gap: space[2], paddingLeft: space[4], paddingRight: space[5] } : { width: 56 }),
          borderRadius: radii.pastilla,
          backgroundColor: c.action,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        },
        sombra,
        style,
      ]}
    >
      <Plus size={label ? 24 : 26} strokeWidth={2.5} color={c.onAction} />
      {label ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.onAction }}>{label}</Text> : null}
    </Pressable>
  )
}
