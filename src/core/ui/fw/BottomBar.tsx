import React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { ALTO_BARRA_CON_CENTRO, DIAMETRO_NUEVA_VENTA } from './NuevaVentaCentral'
import { PressableFx } from './PressableFx'

/** Spec FWD `.tabbar`: pastilla de 66 flotando 16 a los lados. `aire`: distancia al borde inferior; con el círculo de 84 (sobresale 9) debe ser >= 9 para quedar dentro de la barra. */
const ALTO_PASTILLA = 66
const AIRE_BARRA = 10
const AIRE_CON_CENTRO = 12

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
 * Barra inferior FWD flotante: pastilla `surface` de 66 sin borde ni sombra sobre el fondo `bg`, ícono 22 y etiqueta 12/800. El activo: etiqueta en `text`,
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
          height: ALTO_PASTILLA,
          borderRadius: radii.pastilla,
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

  const aire = center ? AIRE_CON_CENTRO : AIRE_BARRA
  const altoFila = center ? DIAMETRO_NUEVA_VENTA : ALTO_PASTILLA
  return (
    <View
      accessibilityLabel="Acciones rápidas"
      style={{ height: (center ? ALTO_BARRA_CON_CENTRO : 76) + insets.bottom, backgroundColor: colors.bg }}
    >
      {/* Fondo de la pastilla: decorativo, aparte de la fila para que el círculo de 84 (más alto que ella) quede dentro de su padre y Android le entregue el toque. */}
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + aire, height: ALTO_PASTILLA, borderRadius: radii.pastilla, backgroundColor: colors.surface }}
      />
      <View
        style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + aire - (altoFila - ALTO_PASTILLA) / 2, height: altoFila, flexDirection: 'row', alignItems: 'center' }}
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
    </View>
  )
}
