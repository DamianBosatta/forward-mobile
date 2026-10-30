import React from 'react'
import { View } from 'react-native'
import { radii, space, useColors, useIsDark } from '@/libs/theme'

interface ProgressProps {
  value: number
  max: number
  /** Qué mide la barra; lo lee el lector de pantalla. */
  accessibilityLabel: string
  /** Sobre la barra superior (consola del chofer) la pista cambia de color. */
  sobreBarra?: boolean
}

/** Barra de avance determinada: `value` de `max`, sin animación. */
export function Progress({ value, max, accessibilityLabel, sobreBarra = false }: ProgressProps) {
  const c = useColors()
  const oscuro = useIsDark()
  const proporcion = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const pista = sobreBarra && !oscuro ? c.textSecondary : c.border
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: value }}
      style={{ height: space[2], borderRadius: radii.pastilla, overflow: 'hidden', backgroundColor: pista }}
    >
      <View style={{ height: space[2], width: `${proporcion * 100}%`, backgroundColor: c.brand }} />
    </View>
  )
}
