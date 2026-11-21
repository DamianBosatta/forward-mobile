import React from 'react'
import { View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { radii, useColors } from '@/libs/theme'

interface Props {
  icono: LucideIcon
  /** Color del ícono; por defecto el texto normal. */
  color?: string
  /** Fondo del cuadro; por defecto `surfaceAlt` (receta `.itile` de los mockups). */
  fondo?: string
  testID?: string
}

/** Ícono de 24 dentro de un cuadro de 48 con radio 16 y fondo `surfaceAlt` (receta `.itile`): filas de ajustes y de avisos. */
export function IconoEnCuadro({ icono: Icono, color, fondo, testID }: Props) {
  const c = useColors()
  return (
    <View testID={testID} style={{ width: 48, height: 48, borderRadius: radii.cantidad, backgroundColor: fondo ?? c.surfaceAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icono size={24} color={color ?? c.text} strokeWidth={2} />
    </View>
  )
}
