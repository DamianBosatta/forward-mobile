import React from 'react'
import { View, ViewStyle } from 'react-native'
import { useResponsive } from '@/libs/useResponsive'

// ── ResponsiveRow ─────────────────────────────────────────────────────────────
// Thin layout primitive: renders children in a horizontal row on medium/large
// screens, and collapses to a column on small (or small+medium) screens.
//
//   stackOn='small'        → column on isSmall,             row otherwise
//   stackOn='smallMedium'  → column on isSmall or isMedium, row on isLarge only

export interface ResponsiveRowProps {
  children: React.ReactNode
  /**
   * Which band(s) trigger column stacking. Default: 'small'.
   */
  stackOn?: 'small' | 'smallMedium'
  /** Gap between children in dp. Default: 12. */
  gap?: number
  style?: ViewStyle
}

export function ResponsiveRow({
  children,
  stackOn = 'small',
  gap = 12,
  style,
}: ResponsiveRowProps) {
  const { isSmall, isMedium } = useResponsive()

  const shouldStack =
    stackOn === 'smallMedium' ? isSmall || isMedium : isSmall

  const containerStyle: ViewStyle = {
    flexDirection: shouldStack ? 'column' : 'row',
    gap,
  }

  return (
    <View style={style ? [containerStyle, style] : containerStyle}>
      {children}
    </View>
  )
}
