import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { LucideIcon } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'

export interface BottomBarItem {
  key: string
  label: string
  icon: LucideIcon
  onPress: () => void
}

interface BottomBarProps {
  items: BottomBarItem[]
  activeKey?: string
  /** Se ubica en el medio (el botón flotante de "Nueva venta"). */
  center?: React.ReactNode
}

/**
 * Barra inferior de la lámina F4: alto 76, ícono 22 y etiqueta 12/600.
 * El activo lleva la marca: raya de 3 px arriba y ícono y etiqueta en
 * marca-tinta (la marca sola no llega a 4,5:1 como texto sobre claro).
 */
export function BottomBar({ items, activeKey, center }: BottomBarProps) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const mitad = Math.ceil(items.length / 2)

  const renderItem = ({ key, label, icon: Icono, onPress }: BottomBarItem) => {
    const activo = key === activeKey
    const color = activo ? colors.brandInk : colors.text
    return (
      <Pressable
        key={key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: activo }}
        style={{
          flex: 1,
          alignSelf: 'stretch',
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[1],
          borderTopWidth: 3,
          borderTopColor: activo ? colors.brand : 'transparent',
        }}
      >
        <Icono size={22} color={color} strokeWidth={2} />
        <Text numberOfLines={1} style={{ ...typeScale.etiqueta, color }}>
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <View
      accessibilityLabel="Acciones rápidas"
      style={{
        height: 76 + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {center ? (
        <>
          {items.slice(0, mitad).map(renderItem)}
          <View style={{ flex: 1, alignItems: 'center' }}>{center}</View>
          {items.slice(mitad).map(renderItem)}
        </>
      ) : (
        items.map(renderItem)
      )}
    </View>
  )
}
