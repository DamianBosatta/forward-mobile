import React, { type ReactNode } from 'react'
import { View } from 'react-native'
import { esFallaDeRed } from '@/core/api/errores'
import { space } from '@/libs/theme'
import { Esqueletos } from './Esqueletos'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'

type Bloques = React.ComponentProps<typeof Esqueletos>['bloques']

/** `n` bloques quietos de la misma altura: el esqueleto de una lista o de una pantalla que carga (X1: reusa `Esqueletos`). */
export function esqueletoDeFilas(n: number, alto = 76): Bloques {
  return Array.from({ length: n }, () => ({ alto }))
}

interface ErrorProps {
  /** Lo que devolvió la consulta al fallar (`query.error`). */
  error: unknown
  titulo: string
  /** Cuándo guardó el teléfono lo que había (ms); solo para el texto de "sin conexión". */
  guardadoA?: number
  onReintentar?: () => void
  /** Reemplaza el texto de "error" (por ejemplo el mensaje del servidor); "sin conexión" conserva el suyo. */
  texto?: string
}

/** Falla de una consulta: "sin conexión" si el pedido no llegó, "error" si llegó y falló; en ambos, Reintentar. */
export function ErrorDeConsulta({ error, titulo, guardadoA, onReintentar, texto }: ErrorProps) {
  const accion = onReintentar ? { label: 'Reintentar', onPress: onReintentar } : undefined
  const sinRed = esFallaDeRed(error)
  return <EstadoDePantalla tipo={sinRed ? 'sinConexion' : 'error'} titulo={titulo} texto={sinRed ? undefined : texto} guardadoA={guardadoA} accion={accion} />
}

interface Props {
  cargando: boolean
  /** Lo que devolvió la consulta al fallar (`query.error`). Sin valor, no hubo falla. */
  error?: unknown
  /** La consulta terminó sin nada que mostrar. */
  vacio?: boolean
  /** Qué ocupa el lugar mientras carga. Sin dato, tres filas. */
  esqueleto?: Bloques
  tituloError: string
  tituloVacio: string
  textoVacio?: string
  /** Cuándo guardó el teléfono lo que había (ms); solo para el texto de "sin conexión". */
  guardadoA?: number
  onReintentar?: () => void
  children: ReactNode
}

/**
 * Los cuatro estados de una consulta con el mismo dibujo en toda la app: esqueleto, sin conexión, error
 * y vacío; con datos muestra `children`. Presentacional: la pantalla le pasa lo que ya tiene (X1/X4).
 */
export function EstadoDeConsulta({ cargando, error, vacio, esqueleto, tituloError, tituloVacio, textoVacio, guardadoA, onReintentar, children }: Props) {
  if (cargando) {
    return (
      <View style={{ padding: space[4] }}>
        <Esqueletos bloques={esqueleto ?? esqueletoDeFilas(3)} />
      </View>
    )
  }
  if (error) return <ErrorDeConsulta error={error} titulo={tituloError} guardadoA={guardadoA} onReintentar={onReintentar} />
  if (vacio) return <EstadoDePantalla tipo="vacio" titulo={tituloVacio} texto={textoVacio} />
  return <>{children}</>
}
