import React from 'react'
import { Text, type StyleProp, type ViewStyle } from 'react-native'
import { Plus } from 'lucide-react-native'
import { useInsetInferior } from './insetInferior'
import { PressableFx } from './PressableFx'
import { maxFontScale, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'

interface FabProps {
  /** Obligatorio: el botón es solo un ícono. */
  accessibilityLabel: string
  onPress: () => void
  /** Texto junto al ícono ("Nueva venta"): el botón pasa a pastilla de 56 de alto, sin ancho fijo. */
  label?: string
  /** Por defecto, abajo a la derecha (16 / 24, como en la lámina). */
  style?: StyleProp<ViewStyle>
}

/** Botón flotante FWD: 56 px, `fabBg` (lime en claro, teal en oscuro) con ícono y texto `onFab` (ink) y la única sombra. */
export function Fab({ accessibilityLabel, onPress, label, style }: FabProps) {
  const c = useColors()
  const inset = useInsetInferior()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <PressableFx
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      android_ripple={{ color: c.ink, foreground: true }}
      style={[
        {
          position: 'absolute',
          right: space[4],
          bottom: space[6] + inset,
          height: 56,
          ...(label ? { flexDirection: 'row' as const, gap: space[2], paddingLeft: space[4], paddingRight: space[5] } : { width: 56 }),
          borderRadius: radii.pastilla,
          backgroundColor: c.fabBg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        sombra,
        style,
      ]}
    >
      <Plus size={label ? 24 : 26} strokeWidth={2.5} color={c.onFab} />
      {label ? <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: c.onFab }}>{label}</Text> : null}
    </PressableFx>
  )
}
