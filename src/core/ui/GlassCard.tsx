import React from 'react'
import { View, StyleSheet, ViewStyle, Platform, StyleProp } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors, useIsDark } from '@/libs/theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
  tint?: 'light' | 'dark' | 'default'
  borderColor?: [string, string, ...string[]]
}

/**
 * GlassCard - Contenedor Premium con Glassmorphism y Borde Luminoso.
 * Ideal para tarjetas, paneles de control y modales.
 */
export const GlassCard = ({
  children,
  style,
  intensity = 30,
  tint,
  borderColor
}: GlassCardProps) => {
  const isDark = useIsDark()
  const colors = useColors()
  
  const resolvedTint = tint ?? (isDark ? 'dark' : 'light')
  // Default border is transparent (owner: simple/flat, no gray card outlines).
  // Cards that want an accent still pass an explicit `borderColor` prop.
  const resolvedBorder: [string, string] = borderColor
    ? [borderColor[0], borderColor[1] ?? borderColor[0]]
    : ['transparent', 'transparent']
    
  const flattenedStyle = StyleSheet.flatten(style) || {}
  
  const { 
    padding = 24, paddingHorizontal, paddingVertical, 
    paddingLeft, paddingRight, paddingTop, paddingBottom, 
    borderRadius: customRadius,
    // Layout props to pass to inner container
    flexDirection,
    alignItems,
    justifyContent,
    flexWrap,
    alignContent,
    gap,
    rowGap,
    columnGap,
    backgroundColor,
    ...outerStyle 
  } = flattenedStyle

  const finalRadius = (customRadius as number) ?? 24
  const innerRadius = Math.max(0, finalRadius - 1)
  // A border passed via style lands on the OUTER container, which had no radius,
  // so it drew a square frame around the rounded content. Round the container too
  // (radius + border width keeps it concentric with the inner rounded layers).
  const borderW = (flattenedStyle.borderWidth as number) ?? 0

  // Spacing and Layout for the inner container
  const innerStyle: ViewStyle = {
    padding,
    paddingHorizontal,
    paddingVertical,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    flexDirection,
    alignItems,
    justifyContent,
    flexWrap,
    alignContent,
    gap,
    rowGap,
    columnGap,
    flexGrow: 1, // Changed from flex: 1 to flexGrow: 1 to prevent collapsing when parent has no fixed height
  }

  // Remove undefined keys
  Object.keys(innerStyle).forEach(key => 
    (innerStyle as any)[key] === undefined && delete (innerStyle as any)[key]
  )

  return (
    <View style={[
      styles.container,
      { shadowOpacity: isDark ? 0.25 : 0.1, backgroundColor: 'transparent', borderRadius: finalRadius + borderW },
      outerStyle
    ]}>
      {/* ── Borde Luminoso de 1px ── */}
      <LinearGradient
        colors={resolvedBorder}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.luminousBorder, { borderRadius: finalRadius }]}
      >
        <BlurView 
          intensity={intensity} 
          tint={resolvedTint} 
          style={[styles.blurContainer, { borderRadius: innerRadius, backgroundColor: backgroundColor || (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)') }]}
        >
          <View style={innerStyle}>
            {children}
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    // Removed shadow properties that cause square artifacts on Android
  },
  luminousBorder: {
    padding: 1, // Espaciado para simular el borde de 1px
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  blurContainer: {
    // Se eliminó el padding default de aquí para que sea controlado por las props
    width: '100%',
  }
})
