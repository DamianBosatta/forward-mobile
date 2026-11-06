import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, useColors } from '@/libs/theme'
import { paddingInferiorDelPie } from './espacioTeclado'
import { useEspacioTeclado } from './useEspacioTeclado'

interface PieFijoProps {
  children: React.ReactNode
  /** Fondo del pie: `surface` (por defecto) o `bg` cuando la pantalla es de fondo base. */
  fondo?: 'surface' | 'bg'
  /** Suma la barra del sistema abajo mientras el teclado está cerrado. Usalo en Modal y hojas que llegan al borde. */
  conInsetInferior?: boolean
  gap?: number
  /** Relleno de arriba y de abajo (el horizontal es siempre space[4]). Por defecto space[4]. */
  relleno?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Pie de formulario: el botón principal queda justo sobre el teclado mientras está abierto
 * (y sin la barra del sistema debajo). Todo formulario con un campo de texto usa este pie.
 * Va como último hijo de una columna que llega al borde inferior (pantalla o Modal).
 */
export function PieFijo({ children, fondo = 'surface', conInsetInferior = false, gap = space[2], relleno = space[4], style, testID }: PieFijoProps) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const { ref, onLayout, tecladoAbierto, espacio } = useEspacioTeclado()
  return (
    <View
      ref={ref}
      onLayout={onLayout}
      testID={testID}
      style={[{ backgroundColor: fondo === 'bg' ? c.bg : c.surface, borderTopWidth: 1, borderTopColor: c.border }, style]}
    >
      <View
        testID={testID ? `${testID}-contenido` : undefined}
        style={{
          paddingHorizontal: space[4],
          paddingTop: relleno,
          gap,
          paddingBottom: paddingInferiorDelPie({ base: relleno, inset: bottom, usaInset: conInsetInferior, tecladoAbierto, espacio }),
        }}
      >
        {children}
      </View>
    </View>
  )
}
