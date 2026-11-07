import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { PasosNumerados } from '@/core/ui/fw/PasosNumerados'

// Nombres cortos: con cuatro pasos tienen que entrar en 360 de ancho.
const PASOS = ['Cliente', 'Productos', 'Carrito', 'Entrega'] as const

interface Props {
  /** El paso en el que está la venta: 1 cliente, 2 productos, 3 carrito, 4 entrega y facturación. */
  paso: 1 | 2 | 3 | 4
}

/**
 * Barra de pasos de la venta nueva (mockups ventas-nueva-1/2 y carrito en el teléfono): `PasosNumerados` con los
 * nombres fijos de la venta y, arriba, "Paso N de 4" (la barra superior no tiene lugar para él con el estado de guardado).
 */
export function PasosVenta({ paso }: Props) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar }}>
      <Text style={{ ...typeScale.secundario, color: c.onTopBar, paddingHorizontal: space[4], paddingTop: space[1] }}>{`Paso ${paso} de ${PASOS.length}`}</Text>
      <PasosNumerados nombres={PASOS} paso={paso} />
    </View>
  )
}
