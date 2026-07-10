import React from 'react'
import { View, ViewStyle } from 'react-native'
import { useResponsive } from '@/libs/useResponsive'

interface BentoItemProps {
  children: React.ReactNode
  span?: 1 | 2
  style?: ViewStyle
}

export const BentoItem = ({ children, span = 1, style }: BentoItemProps) => {
  const { isSmall, isLarge } = useResponsive()
  // span=2 → always full width (all bands)
  // span=1 → small: 1-col (100%), medium: 2-col (48.5%), large: 3-col (31.5%)
  const width = span === 2 ? '100%' : isSmall ? '100%' : isLarge ? '31.5%' : '48.5%'
  return (
    <View style={[{ width, marginBottom: 12 }, style]}>
      {children}
    </View>
  )
}

interface BentoGridProps {
  children: React.ReactNode
  style?: ViewStyle
}

export const BentoGrid = ({ children, style }: BentoGridProps) => {
  return (
    <View 
      style={[{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
        width: '100%'
      }, style]}
    >
      {children}
    </View>
  )
}
