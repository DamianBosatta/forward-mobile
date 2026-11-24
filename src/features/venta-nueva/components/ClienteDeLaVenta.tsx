import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { direccionDeEntrega, nombreDelCliente, type ClienteNombrable } from '@/features/clientes/lib/cliente'

interface Props {
  cliente: ClienteNombrable
  /** "Presupuesto" va junto al nombre; un pedido no lleva rótulo. */
  rotulo?: string
}

/**
 * El cliente de la venta bajo la barra, igual en los pasos 2 a 4: la dirección primero y el nombre en otra línea
 * (receta "Cliente y dirección"). Las dos líneas se parten en vez de cortarse con "…".
 */
export function ClienteDeLaVenta({ cliente, rotulo }: Props) {
  const c = useColors()
  const nombre = [nombreDelCliente(cliente), rotulo].filter(Boolean).join(' · ')
  return (
    <View testID="cliente-de-la-venta" style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[2] }}>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.onTopBarStrong }}>{direccionDeEntrega(cliente)}</Text>
      {nombre ? <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>{nombre}</Text> : null}
    </View>
  )
}
