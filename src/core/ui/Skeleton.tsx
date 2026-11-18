import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, ViewStyle } from 'react-native'
import { useColors } from '@/libs/theme'

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
  const opacity = useRef(new Animated.Value(0.3)).current
  const [reducir, setReducir] = useState(false)

  useEffect(() => {
    let vivo = true
    void AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (vivo) setReducir(Boolean(v)) }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReducir)
    return () => { vivo = false; sub?.remove?.() }
  }, [])

  useEffect(() => {
    if (reducir) {
      opacity.setValue(0.5)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reducir, opacity])

  return (
    <Animated.View
      style={[
        { width: width as any, height: height as any, borderRadius, backgroundColor: c.borderStrong, opacity },
        style,
      ]}
    />
  )
}
