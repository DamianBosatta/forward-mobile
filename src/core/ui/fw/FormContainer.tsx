import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useResponsive } from '@/libs/useResponsive'

/** Ancho máximo de un formulario en tablet (plan §8). */
export const FORM_MAX_WIDTH = 640

interface FormContainerProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Formulario de una columna. En teléfono ocupa todo el ancho; en tablet
 * (≥ 600) se centra con un ancho máximo, para que los campos no se estiren
 * de borde a borde.
 */
export function FormContainer({ children, style }: FormContainerProps) {
  const { isTablet } = useResponsive()
  return (
    <View
      testID="form-container"
      style={[{ width: '100%' }, isTablet && { maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' }, style]}
    >
      {children}
    </View>
  )
}
