import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Minus, Plus } from 'lucide-react-native'
import { radii, space, typeScale, useColors, importe } from '@/libs/theme'

interface Props {
  value: number
  max: number
  onChange: (value: number) => void
  /** Nombre de lo que se cuenta: arma "Quitar una de X" y "Sumar una de X". */
  nombre: string
}

/** Contador de 56 px para cargar cantidades con el pulgar (lámina chofer-03): el + va relleno, el tope es lo disponible. */
export function Stepper({ value, max, onChange, nombre }: Props) {
  const c = useColors()
  const puedeBajar = value > 0
  const puedeSubir = value < max
  const boton = (activo: boolean, relleno: boolean) => ({
    width: 56,
    height: 56,
    borderRadius: radii.campo,
    borderWidth: 2,
    borderColor: activo ? (relleno ? c.action : c.textSecondary) : c.border,
    backgroundColor: activo ? (relleno ? c.action : c.surface) : c.surface2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  })
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quitar una de ${nombre}`}
        accessibilityState={{ disabled: !puedeBajar }}
        disabled={!puedeBajar}
        onPress={() => onChange(value - 1)}
        style={boton(puedeBajar, false)}
      >
        <Minus size={26} color={puedeBajar ? c.text : c.textSecondary} strokeWidth={3} />
      </Pressable>
      <Text accessibilityLabel={`Cantidad de ${nombre}: ${value}`} style={{ ...typeScale.titulo, ...importe, fontSize: 26, lineHeight: 32, minWidth: 40, textAlign: 'center', color: c.text }}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sumar una de ${nombre}`}
        accessibilityState={{ disabled: !puedeSubir }}
        disabled={!puedeSubir}
        onPress={() => onChange(value + 1)}
        style={boton(puedeSubir, true)}
      >
        <Plus size={26} color={puedeSubir ? c.onAction : c.textSecondary} strokeWidth={3} />
      </Pressable>
    </View>
  )
}
