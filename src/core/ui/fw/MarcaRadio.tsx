import React from 'react'
import { View } from 'react-native'
import { Check } from 'lucide-react-native'
import { useColors } from '@/libs/theme'

interface Props {
  elegido: boolean
  /** La fila elegida va en teal (compra nueva, proveedores): la marca se invierte, disco `ink` con tilde teal. */
  sobreTeal?: boolean
}

/**
 * Círculo de elección de las filas (mockups ventas-nueva-1, compras-nueva-1/2, proveedores-nuevo): vacío con contorno si no
 * está elegida; elegida = disco teal con tilde `ink` (sobre una fila teal: disco `ink` con tilde teal). Solo marca: el toque
 * es de la fila, que lleva el rol radio. El estado también va en el tilde, nunca solo en el color.
 */
export function MarcaRadio({ elegido, sobreTeal = false }: Props) {
  const c = useColors()
  const relleno = sobreTeal ? c.ink : c.teal
  const tilde = sobreTeal ? c.teal : c.ink
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: elegido ? 0 : 2, borderColor: c.borderStrong, backgroundColor: elegido ? relleno : 'transparent' }}>
      {elegido ? <Check size={14} color={tilde} strokeWidth={3} /> : null}
    </View>
  )
}
