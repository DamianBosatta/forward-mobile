import React from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'

/** Token `press` de la spec FWD §6: escala 0.95, opacidad 0.85, 120 ms. Solo `transform` y `opacity`. */
export const PRESS = { escala: 0.95, opacidad: 0.85, duracion: 120 } as const

const PressableAnimado = Animated.createAnimatedComponent(Pressable)

interface Props extends Omit<PressableProps, 'style'> {
  /** Estilo fijo (nunca una función de `pressed`: NativeWind 4 la descarta). */
  style?: StyleProp<ViewStyle>
}

/**
 * `Pressable` con la respuesta al toque de la spec (§6). Con Reduce Motion activado no anima y queda el
 * ripple nativo. La opacidad de reposo del estilo (p. ej. 0.55 de un deshabilitado) se respeta.
 */
export const PressableFx = React.forwardRef<React.ComponentRef<typeof Pressable>, Props>(function PressableFx(
  { style, onPressIn, onPressOut, ...resto },
  ref,
) {
  const reducido = useReducedMotion()
  const progreso = useSharedValue(0)
  const reposo = StyleSheet.flatten(style)?.opacity
  const base = typeof reposo === 'number' ? reposo : 1
  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - PRESS.escala) * progreso.value }],
    opacity: base * (1 - (1 - PRESS.opacidad) * progreso.value),
  }))
  const mover = (a: number) => {
    if (!reducido) progreso.value = withTiming(a, { duration: PRESS.duracion })
  }
  return (
    <PressableAnimado
      {...resto}
      ref={ref}
      onPressIn={(e: GestureResponderEvent) => {
        mover(1)
        onPressIn?.(e)
      }}
      onPressOut={(e: GestureResponderEvent) => {
        mover(0)
        onPressOut?.(e)
      }}
      style={reducido ? style : [style, animado]}
    />
  )
})
