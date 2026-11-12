import React, { useEffect } from 'react'
import { View, StyleSheet, ViewStyle, Animated } from 'react-native'
import { useColors } from '@/libs/theme'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: ViewStyle
}

/**
 * Componente Skeleton con animación de "shimmer" (pulso)
 */
export const Skeleton = ({ width, height, borderRadius = 8, style }: SkeletonProps) => {
  const c = useColors()
  const opacity = new Animated.Value(0.3)

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: c.borderStrong,
          opacity,
        },
        style,
      ]}
    />
  )
}
