import React from 'react'
import { View, ViewStyle } from 'react-native'
import { useResponsive } from '@/libs/useResponsive'
import { tokens } from '@/libs/theme'

// ── ResponsiveGrid ────────────────────────────────────────────────────────────
// Band-aware N-column grid. Uses the negative-margin gutter technique so that
// percentage-basis cells don't overflow: container pulls in -gap/2 on each
// side; cells pad back gap/2 inward — keeps total row width at 100%.
//
// Column resolution (all three bands addressable, with sensible fallbacks):
//   isLarge  → large  ?? medium ?? 1
//   isMedium → medium ?? large  ?? 1
//   isSmall  → small  ?? 1

export interface ResponsiveGridProps {
  children: React.ReactNode
  /**
   * Columns per responsive band. Omit a band to fall back to the next
   * populated band. Defaults: small=1, medium=2, large=3.
   */
  columns?: { small?: number; medium?: number; large?: number }
  /** Gutter size in dp. Default: tokens.spacing.sm (8). */
  gap?: number
  style?: ViewStyle
}

export function ResponsiveGrid({
  children,
  columns = {},
  gap = tokens.spacing.sm,
  style,
}: ResponsiveGridProps) {
  const { isSmall, isLarge } = useResponsive()
  const { small = 1, medium = 2, large = 3 } = columns

  const cols = isLarge
    ? (large ?? medium ?? 1)
    : isSmall
    ? (small ?? 1)
    : (medium ?? large ?? 1)

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -gap / 2,
  }

  return (
    <View style={style ? [containerStyle, style] : containerStyle}>
      {React.Children.map(children, (child, index) => (
        <View
          key={index}
          style={{
            width: `${100 / cols}%`,
            paddingHorizontal: gap / 2,
            marginBottom: gap,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  )
}
