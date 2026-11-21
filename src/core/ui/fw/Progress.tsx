import React from 'react'
import { View } from 'react-native'
import { radii, useColors, useIsDark } from '@/libs/theme'

const ALTO = 12

interface ProgressProps {
  value: number
  max: number
  /** Qué mide la barra; lo lee el lector de pantalla. */
  accessibilityLabel: string
  /** Sobre la barra superior (consola del chofer) la pista cambia de color. */
  sobreBarra?: boolean
  /** Sobre una tarjeta lime o teal: receta de la spec (pista ink al 20 %, relleno ink). Sin esto, pista `surfaceAlt` y relleno `accentText`, que se ven sobre `surface` y `bg` en los dos temas. */
  sobreColor?: boolean
}

/** Barra de avance FWD (spec §5): 12 de alto. Sobre lime o teal (`sobreColor`): pista ink al 20 %, relleno ink. Sin animación. */
export function Progress({ value, max, accessibilityLabel, sobreBarra = false, sobreColor = false }: ProgressProps) {
  const c = useColors()
  const oscuro = useIsDark()
  const proporcion = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const pista = sobreColor ? c.veilInk20 : sobreBarra && !oscuro ? c.textSecondary : sobreBarra ? c.borderStrong : c.surfaceAlt
  const relleno = sobreColor ? c.ink : sobreBarra ? c.brand : c.accentText
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: value }}
      style={{ height: ALTO, borderRadius: radii.pastilla, overflow: 'hidden', backgroundColor: pista }}
    >
      <View style={{ height: ALTO, width: `${proporcion * 100}%`, backgroundColor: relleno, borderRadius: radii.pastilla }} />
    </View>
  )
}
