import React from 'react'
import { MotiView } from 'moti'
import { ViewStyle } from 'react-native'

interface AnimatedListItemProps {
  children: React.ReactNode
  index: number
  style?: ViewStyle
  preset?: 'slideUp' | 'fadeIn' | 'zoom'
}

export const AnimatedListItem = ({ 
  children, 
  index, 
  style,
  preset = 'slideUp'
}: AnimatedListItemProps) => {
  const getAnimation = () => {
    switch (preset) {
      case 'fadeIn':
        return {
          from: { opacity: 0 },
          animate: { opacity: 1 },
        }
      case 'zoom':
        return {
          from: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
        }
      default: // slideUp
        return {
          from: { opacity: 0, translateY: 30 },
          animate: { opacity: 1, translateY: 0 },
        }
    }
  }

  const anim = getAnimation()

  return (
    <MotiView
      from={anim.from}
      animate={anim.animate}
      transition={{
        type: 'spring',
        delay: index * 50,
        damping: 20,
        stiffness: 90,
      }}
      style={style}
    >
      {children}
    </MotiView>
  )
}
