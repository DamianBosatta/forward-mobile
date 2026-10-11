import { useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'
import type { EstadoVenta, Venta } from '@/libs/api-client'

export type PestanaVentas = 'presupuestos' | 'pedidos'
export type PeriodoVentas = 'hoy' | '7d' | '30d' | 'todo'
export type FiltroEstado = 'todos' | EstadoVenta

/** TipoOperacionVenta del servidor: 1 = Presupuesto, 2 = Pedido. */
const TIPO: Record<PestanaVentas, number> = { presupuestos: 1, pedidos: 2 }
const ESPERA_BUSQUEDA_MS = 400

/**
 * Desde qué día pedir (yyyy-MM-dd). El servidor lo toma como día de Argentina
 * (`ArgentinaClock.StartOfBusinessDayUtc`), así que se manda el día, no un instante.
 */
export function fechaDesdePeriodo(periodo: PeriodoVentas, hoy: Date = new Date()): string | undefined {
  const dias = { hoy: 0, '7d': 6, '30d': 29, todo: null }[periodo]
  return dias === null ? undefined : format(subDays(hoy, dias), 'yyyy-MM-dd')
}

/**
 * Lista de ventas con el formato nuevo (Bloque 9A, PR 2.1). Todo filtro va al servidor:
 * tipo, estado, período y búsqueda. Nada se filtra sobre las páginas cargadas, así que el
 * contador "Mostrando N de M" vale con cualquier filtro.
 */
export function useVentasListaNueva() {
  const [pestana, setPestana] = useState<PestanaVentas>('pedidos')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [periodo, setPeriodo] = useState<PeriodoVentas>('30d')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEnviada(busqueda.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])

  const ventas = useInfiniteVentas({
    pageSize: 20,
    tipoOperacion: TIPO[pestana],
    estado: estado === 'todos' ? undefined : estado,
    fechaDesde: fechaDesdePeriodo(periodo),
    searchTerm: busquedaEnviada.length >= 2 ? busquedaEnviada : undefined,
  })

  const items = useMemo(() => itemsCargados<Venta>(ventas.data?.pages), [ventas.data])
  const contador = textoContador(items.length, totalDelServidor(ventas.data?.pages))

  return {
    pestana, setPestana,
    estado, setEstado,
    periodo, setPeriodo,
    busqueda, setBusqueda,
    ventas: items,
    contador,
    ventasQuery: ventas,
  }
}
