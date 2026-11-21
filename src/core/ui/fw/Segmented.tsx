import React from 'react'
import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from './PressableFx'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  accessibilityLabel: string
}

/** Selector segmentado FWD: píldora `surfaceAlt` sin borde ni sombra; el elegido pasa a botón principal con tilde. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const colors = useColors()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: space[1],
        padding: space[1],
        backgroundColor: colors.surfaceAlt,
        borderRadius: radii.pastilla,
      }}
    >
      {options.map((op) => {
        const elegido = op.value === value
        return (
          <PressableFx
            key={op.value}
            onPress={() => {
              if (!elegido) onChange(op.value)
            }}
            accessibilityRole="radio"
            accessibilityLabel={op.label}
            accessibilityState={{ selected: elegido, checked: elegido }}
            style={{
              flexGrow: 1,
              flexDirection: 'row',
              gap: space[1],
              flexShrink: 0,
              minHeight: 44,
              borderRadius: radii.pastilla,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space[1],
              backgroundColor: elegido ? colors.primaryBg : 'transparent',
            }}
          >
            {elegido ? <Check size={16} color={colors.primaryFg} strokeWidth={2.5} /> : null}
            <Text
              numberOfLines={1}
              style={{
                ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo),
                color: elegido ? colors.primaryFg : colors.textMuted,
              }}
            >
              {op.label}
            </Text>
          </PressableFx>
        )
      })}
    </View>
  )
}
