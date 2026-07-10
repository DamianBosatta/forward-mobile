import type { ReactNode } from 'react'
import { View, type ViewStyle, type StyleProp } from 'react-native'

interface ScreenContainerProps {
  children: ReactNode
  /** Max content width on large screens. Forms ~480-600, list/dashboard ~1100. */
  maxWidth?: number
  /** Horizontal gutter applied at all sizes. */
  gutter?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Full-bleed parent + width-clamped, centered content.
 * Phones (< maxWidth): no-op pass-through (content fills width).
 * Tablets: caps and centers the content so forms/buttons/rows don't stretch
 * edge-to-edge. Keep page backgrounds OUTSIDE this wrapper so they stay full-bleed.
 */
export function ScreenContainer({ children, maxWidth = 600, gutter = 0, style }: ScreenContainerProps) {
  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
      <View style={[{ flex: 1, width: '100%', maxWidth, paddingHorizontal: gutter }, style]}>
        {children}
      </View>
    </View>
  )
}
