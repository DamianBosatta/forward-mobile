import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'

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

/** Selector segmentado de la lámina F4: segmentos de 44 px sobre superficie-2; el elegido en superficie con sombra. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const colors = useColors()
  const sombra = useIsDark() ? shadowMd.dark : shadowMd.light

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: space[1],
        padding: space[1],
        backgroundColor: colors.surface2,
        borderRadius: radii.campo,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      }}
    >
      {options.map((op) => {
        const elegido = op.value === value
        return (
          <Pressable
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
              borderRadius: radii.campo,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space[1],
              borderWidth: elegido ? 2 : 0,
              borderColor: colors.brand,
              backgroundColor: elegido ? colors.surface : 'transparent',
              ...(elegido ? sombra : null),
            }}
          >
            {elegido ? <Check size={16} color={colors.brandInk} strokeWidth={2.5} /> : null}
            <Text
              numberOfLines={1}
              style={{
                ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo),
                color: elegido ? colors.text : colors.textSecondary,
              }}
            >
              {op.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
