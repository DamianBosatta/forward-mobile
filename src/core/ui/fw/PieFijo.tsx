import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { space, useColors } from '@/libs/theme'
import { paddingInferiorDelPie } from './espacioTeclado'
import { useInsetInferior } from './insetInferior'
import { useEspacioTeclado } from './useEspacioTeclado'

interface PieFijoProps {
  children: React.ReactNode
  /** Fondo del pie: `surface` (por defecto) o `bg` cuando la pantalla es de fondo base. */
  fondo?: 'surface' | 'bg'
  /** Solo si el pie queda sobre otra barra que ya cubre la barra del sistema. Por defecto el pie suma la barra del sistema (sola mientras el teclado está cerrado; dentro de ConAccesosRapidos no se suma). */
  sinInsetInferior?: boolean
  /** @deprecated Es el comportamiento por defecto; se ignora. */
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
export function PieFijo({ children, fondo = 'surface', sinInsetInferior = false, gap = space[2], relleno = space[4], style, testID }: PieFijoProps) {
  const c = useColors()
  const bottom = useInsetInferior()
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
          paddingBottom: paddingInferiorDelPie({ base: relleno, inset: bottom, usaInset: !sinInsetInferior, tecladoAbierto, espacio }),
        }}
      >
        {children}
      </View>
    </View>
  )
}
