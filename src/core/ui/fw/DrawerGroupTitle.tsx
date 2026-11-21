import React from 'react'
import { Text } from 'react-native'
import { maxFontScale, space, typeScale, useColors } from '@/libs/theme'

/** Título de sección del menú lateral (VENDER, COMPRAR, GESTIÓN). */
export function DrawerGroupTitle({ children, oscuro = false }: { children: string; oscuro?: boolean }) {
  const c = useColors()
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={maxFontScale}
      style={{ ...typeScale.etiquetaChip, letterSpacing: 0.7, color: oscuro ? c.onPanelOscuro : c.textMuted, paddingHorizontal: space[3], paddingTop: space[3], paddingBottom: space[1] }}
    >
      {children}
    </Text>
  )
}
