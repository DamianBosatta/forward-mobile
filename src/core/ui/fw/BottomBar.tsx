import React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { LucideIcon } from 'lucide-react-native'
import { maxFontScale, space, typeScale, useColors } from '@/libs/theme'
import { ALTO_BARRA_CON_CENTRO } from './NuevaVentaCentral'
import { PressableFx } from './PressableFx'

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
 * Barra inferior FWD: `surface` sin borde, alto 76, ícono 22 y etiqueta 12/800. El activo: etiqueta en `text`,
 * ícono y raya de 3 px arriba en `accentText` (petróleo en claro, lime en oscuro); la raya hace que no dependa solo del color.
 */
export function BottomBar({ items, activeKey, center }: BottomBarProps) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const mitad = Math.ceil(items.length / 2)

  const renderItem = ({ key, label, icon: Icono, onPress }: BottomBarItem) => {
    const activo = key === activeKey
    const color = activo ? colors.accentText : colors.text
    return (
      <PressableFx
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
          borderTopColor: activo ? colors.accentText : 'transparent',
        }}
      >
        <Icono size={22} color={color} strokeWidth={2} />
        <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.etiqueta, color: activo ? colors.text : colors.textMuted }}>
          {label}
        </Text>
      </PressableFx>
    )
  }

  return (
    <View
      accessibilityLabel="Acciones rápidas"
      style={{
        height: (center ? ALTO_BARRA_CON_CENTRO : 76) + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
      }}
    >
      {center ? (
        <>
          {items.slice(0, mitad).map(renderItem)}
          <View testID="barra-centro" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{center}</View>
          {items.slice(mitad).map(renderItem)}
        </>
      ) : (
        items.map(renderItem)
      )}
    </View>
  )
}
