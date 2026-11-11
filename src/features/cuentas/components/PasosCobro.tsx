import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { PasosNumerados } from '@/core/ui/fw/PasosNumerados'

// Nombres cortos: con cuatro pasos tienen que entrar en 360 de ancho (como PasosVenta).
export const PASOS_COBRO = ['Cliente', 'Qué se cobra', 'Medios', 'Confirmar'] as const

export type PasoCobro = 1 | 2 | 3 | 4

/** Barra de pasos del cobro (maqueta "Cobros como venta"): la misma forma que la de la venta nueva, con "Paso N de 4" arriba. */
export function PasosCobro({ paso }: { paso: PasoCobro }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar }}>
      <Text style={{ ...typeScale.secundario, color: c.onTopBar, paddingHorizontal: space[4], paddingTop: space[1] }}>{`Paso ${paso} de ${PASOS_COBRO.length}`}</Text>
      <PasosNumerados nombres={PASOS_COBRO} paso={paso} />
    </View>
  )
}
