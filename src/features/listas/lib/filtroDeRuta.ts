import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { EstadoCompra, EstadoVenta } from '@/libs/api-client'

/** Filtro de Ventas que llega por la ruta (`?tipo=presupuestos&estado=Pendiente`). */
export interface FiltroVentasRuta {
  tipo: 'presupuestos' | 'pedidos'
  estado: Extract<EstadoVenta, 'Pendiente' | 'Confirmada' | 'PendienteAutorizacion'>
}

/** Filtro de Compras que llega por la ruta: uno de los dos estados de la pestaña Pendientes. */
export type EstadoCompraRuta = Extract<EstadoCompra, 'NotaPedido' | 'Confirmado'>

const TIPOS: readonly string[] = ['presupuestos', 'pedidos']
const ESTADOS_VENTA: readonly string[] = ['Pendiente', 'Confirmada', 'PendienteAutorizacion']
const ESTADOS_COMPRA: readonly string[] = ['NotaPedido', 'Confirmado']

/**
 * Lee el filtro de la ruta (las filas de Inicio) y lo saca de la ruta una vez leído: si quedara, la
 * misma fila no volvería a aplicarlo después de cambiar el filtro a mano (la ruta no cambiaría).
 * La lista lo aplica en el mismo render en que llega; los efectos del hijo corren antes que este.
 */
function useParametrosDeRuta<K extends string>(claves: readonly K[]): Partial<Record<K, string>> {
  const params: Record<string, string | string[] | undefined> = useLocalSearchParams()
  const router = useRouter()
  const leidos: Partial<Record<K, string>> = {}
  for (const k of claves) {
    const v = params[k]
    if (typeof v === 'string' && v) leidos[k] = v
  }
  const clave = JSON.stringify(leidos)
  useEffect(() => {
    if (clave !== '{}') router.setParams(Object.fromEntries(claves.map((k) => [k, undefined])))
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  return leidos
}

export function useFiltroVentasDeRuta(): FiltroVentasRuta | null {
  const { tipo, estado } = useParametrosDeRuta(['tipo', 'estado'] as const)
  if (!tipo || !estado || !TIPOS.includes(tipo) || !ESTADOS_VENTA.includes(estado)) return null
  return { tipo, estado } as FiltroVentasRuta
}

export function useEstadoCompraDeRuta(): EstadoCompraRuta | null {
  const { estado } = useParametrosDeRuta(['estado'] as const)
  return estado && ESTADOS_COMPRA.includes(estado) ? (estado as EstadoCompraRuta) : null
}

/**
 * Aplica el filtro de la ruta cada vez que llega uno (también con la lista ya montada: las pantallas
 * del menú quedan montadas). Con el mismo filtro dos veces seguidas no hace nada: la ruta lo saca.
 */
export function useAlLlegarFiltro<T>(filtro: T | null, aplicar: (f: T) => void) {
  const clave = filtro ? JSON.stringify(filtro) : null
  useEffect(() => {
    if (filtro) aplicar(filtro)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
}
