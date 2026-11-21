import React from 'react'
import { Text, View } from 'react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  iniciales: string
  nombre: string
  rol?: string
  /** Menú fijo de tablet: cabecera sobre el panel oscuro. */
  oscuro?: boolean
  /** Margen superior del sistema (barra de estado). */
  insetSuperior?: number
}

/** Cabecera del menú lateral: avatar `primary`, nombre y rol, sobre el fondo del panel. */
export function DrawerHeader({ iniciales, nombre, rol, oscuro = false, insetSuperior = 0 }: Props) {
  const c = useColors()
  return (
    <View style={{ paddingTop: insetSuperior + space[4], paddingBottom: space[2], paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.onPrimary }}>{iniciales}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.seccion, color: oscuro ? c.onPanelOscuroStrong : c.text }}>
          {nombre}
        </Text>
        {rol ? (
          <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: oscuro ? c.onPanelOscuro : c.textMuted }}>
            {rol}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
