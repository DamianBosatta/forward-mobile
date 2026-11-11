import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { PasosNumerados } from '@/core/ui/fw/PasosNumerados'

/** Los cuatro pasos de la compra nueva, con los mismos lugares que la venta (Cliente / Productos / Carrito / Entrega). */
export const PASOS_COMPRA = ['Proveedor', 'Productos', 'Carrito', 'Recepción'] as const

export type PasoCompra = 1 | 2 | 3 | 4

/**
 * Barra de pasos de la compra nueva (maqueta "Compras como venta"): la misma que `PasosVenta`, con "Paso N de 4" arriba
 * y los nombres de la compra. Copia local para no tocar la venta: solo cambian los nombres.
 */
export function PasosCompra({ paso }: { paso: PasoCompra }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar }}>
      <Text style={{ ...typeScale.secundario, color: c.onTopBar, paddingHorizontal: space[4], paddingTop: space[1] }}>{`Paso ${paso} de ${PASOS_COMPRA.length}`}</Text>
      <PasosNumerados nombres={PASOS_COMPRA} paso={paso} />
    </View>
  )
}
