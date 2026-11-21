import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeInRight, useReducedMotion } from 'react-native-reanimated'

/** Entrada de las pantallas FWD (spec §Movimiento): `cardIn` para tarjetas, `rowIn` para filas. Solo opacidad y desplazamiento; con Reduce Motion no anima. */
export const ENTRADA = {
  tarjeta: { duracion: 450, escalon: 110, tope: 4 },
  fila: { duracion: 350, escalon: 60, tope: 8 },
} as const

type TipoDeEntrada = keyof typeof ENTRADA

/** Animación de entrada (`entering` de Reanimated) o `undefined` si el sistema pidió menos movimiento. Solo las primeras filas animan y escalonan. */
export function entradaDe(tipo: TipoDeEntrada, indice: number, reducido: boolean, escalon?: number) {
  if (reducido) return undefined
  const { duracion, escalon: paso, tope } = ENTRADA[tipo]
  // Pasada la primera pantalla no se anima: esas filas aparecen al scrollear (o se reciclan) y no pueden esperar ni repetir la entrada.
  if (indice >= tope) return undefined
  const demora = Math.max(indice, 0) * (escalon ?? paso)
  return tipo === 'tarjeta' ? FadeInDown.duration(duracion).delay(demora) : FadeInRight.duration(duracion).delay(demora)
}

interface EntradaProps {
  tipo: TipoDeEntrada
  /** Posición en la lista: define el escalonado. */
  indice?: number
  /** Escalonado en ms; por defecto el del tipo. */
  escalon?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/** Envuelve un bloque con la entrada compartida (`cardIn` / `rowIn`). */
export function Entrada({ tipo, indice = 0, escalon, style, children }: EntradaProps) {
  const reducido = useReducedMotion()
  return (
    <Animated.View entering={entradaDe(tipo, indice, reducido, escalon)} style={style}>
      {children}
    </Animated.View>
  )
}
