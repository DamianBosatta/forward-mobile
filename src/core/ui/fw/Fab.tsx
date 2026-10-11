import React from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, shadowMd, space, useColors, useIsDark } from '@/libs/theme'

interface FabProps {
  /** Obligatorio: el botón es solo un ícono. */
  accessibilityLabel: string
  onPress: () => void
  /** Por defecto, abajo a la derecha (16 / 24, como en la lámina). */
  style?: StyleProp<ViewStyle>
}

/** Botón flotante de la lámina F4: 56 px, color de acción y la única sombra. */
export function Fab({ accessibilityLabel, onPress, style }: FabProps) {
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
          width: 56,
          height: 56,
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
      <Plus size={26} strokeWidth={2.5} color={c.onAction} />
    </Pressable>
  )
}
