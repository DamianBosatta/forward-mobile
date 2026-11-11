import React from 'react'
import { View } from 'react-native'
import { space } from '@/libs/theme'
import { FilaDeInicio, ListaEnTarjeta, SeccionDeInicio, type TonoPunto } from './PiezasDeInicio'

export interface FilaParaResolver {
  /** Lo que se cuenta, en singular y en plural: "pedido por autorizar" / "pedidos por autorizar". */
  nombre: [uno: string, varios: string]
  detalle: string
  /** `null` = sin dato: la fila no se muestra (nunca un 0 inventado). */
  cantidad: number | null
  /** Punto de color en lugar de la pastilla (atención, peligro, en curso). */
  punto: TonoPunto
  onPress: () => void
}

/** "Para resolver" con los textos de la galería v2 (propuesta, frame 7): la cantidad en el título, un punto de color y la flecha. */
export function ParaResolver({ filas }: { filas: FilaParaResolver[] }) {
  const visibles = filas.filter((f): f is FilaParaResolver & { cantidad: number } => f.cantidad != null)
  if (visibles.length === 0) return null
  return (
    <View style={{ paddingHorizontal: space[4] }}>
      <SeccionDeInicio titulo="Para resolver">
        <ListaEnTarjeta testID="para-resolver">
          {visibles.map((f) => (
            <FilaDeInicio
              key={f.nombre[1]}
              titulo={`${f.cantidad} ${f.cantidad === 1 ? f.nombre[0] : f.nombre[1]}`}
              apoyo={f.detalle}
              punto={f.punto}
              onPress={f.onPress}
            />
          ))}
        </ListaEnTarjeta>
      </SeccionDeInicio>
    </View>
  )
}
