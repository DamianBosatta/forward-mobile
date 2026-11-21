import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, ViewStyle } from 'react-native'
import { useColors } from '@/libs/theme'

/** Receta FWD `shimmer`: el bloque `surfaceAlt` respira entre 100 % y 55 % de opacidad. */
const PULSO_ALTO = 1
const PULSO_BAJO = 0.55

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: ViewStyle
}

/**
 * Bloque que ocupa el lugar de lo que carga, con pulso. El `Animated.Value` se crea una sola vez y,
 * con Reduce Motion activado, el bloque queda quieto (como `Esqueletos`).
 */
export const Skeleton = ({ width, height, borderRadius = 8, style }: SkeletonProps) => {
  const c = useColors()
  const opacity = useRef(new Animated.Value(PULSO_BAJO)).current
  const [reducir, setReducir] = useState(false)

  useEffect(() => {
    let vivo = true
    void AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (vivo) setReducir(Boolean(v)) }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReducir)
    return () => { vivo = false; sub?.remove?.() }
  }, [])

  useEffect(() => {
    if (reducir) {
      opacity.setValue(PULSO_ALTO)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: PULSO_ALTO, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: PULSO_BAJO, duration: 800, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reducir, opacity])

  return (
    <Animated.View
      style={[
        { width: width as any, height: height as any, borderRadius, backgroundColor: c.surfaceAlt, opacity },
        style,
      ]}
    />
  )
}
