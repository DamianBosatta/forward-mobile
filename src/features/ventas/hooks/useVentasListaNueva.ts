import { useEffect, useMemo, useState } from 'react'
import { diaArgentina } from '@/src/utils/date'
import { useBorradoresVentaMios, useInfiniteVentas, useVentasResumen } from '@/libs/api-client/ventas'
import { itemsCargados, totalDelServidor } from '@/features/listas/lib/contador'
import { contadorVentas } from '../lib/resumenVentas'
import type { EstadoVenta, Venta } from '@/libs/api-client'

export type PestanaVentas = 'presupuestos' | 'pedidos' | 'borradores'
export type PeriodoVentas = 'hoy' | '7d' | '30d' | 'todo'
export type FiltroEstado = 'todos' | EstadoVenta

/** TipoOperacionVenta del servidor: 1 = Presupuesto, 2 = Pedido. */
const TIPO: Record<Exclude<PestanaVentas, 'borradores'>, number> = { presupuestos: 1, pedidos: 2 }
const ESPERA_BUSQUEDA_MS = 400

/**
 * Desde qué día pedir (yyyy-MM-dd). El servidor lo toma como día de Argentina
 * (`ArgentinaClock.StartOfBusinessDayUtc`), así que se manda el día argentino, no el del teléfono.
 */
export function fechaDesdePeriodo(periodo: PeriodoVentas, hoy: Date = new Date()): string | undefined {
  const dias = { hoy: 0, '7d': 6, '30d': 29, todo: null }[periodo]
  return dias === null ? undefined : diaArgentina(hoy.getTime() - dias * 24 * 60 * 60 * 1000)
}

/**
 * Lista de ventas con el formato nuevo (Bloque 9A, PR 2.1). Todo filtro va al servidor:
 * tipo, estado, período y búsqueda. Nada se filtra sobre las páginas cargadas, así que el
 * contador "Mostrando N de M" vale con cualquier filtro. El resumen se pide con los mismos filtros
 * y da M y el importe del filtro ("· $ X").
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

  const esBorradores = pestana === 'borradores'
  const filtro = {
    tipoOperacion: TIPO[esBorradores ? 'pedidos' : pestana],
    estado: estado === 'todos' ? undefined : estado,
    fechaDesde: fechaDesdePeriodo(periodo),
    searchTerm: busquedaEnviada.length >= 2 ? busquedaEnviada : undefined,
  }
  const ventas = useInfiniteVentas({ pageSize: 20, ...filtro }, { enabled: !esBorradores })
  const resumen = useVentasResumen(filtro, { enabled: !esBorradores })
  const borradores = useBorradoresVentaMios(esBorradores)

  const items = useMemo(() => itemsCargados<Venta>(ventas.data?.pages), [ventas.data])
  const contador = contadorVentas(items.length, totalDelServidor(ventas.data?.pages), resumen.data, {
    tipoOperacion: filtro.tipoOperacion,
    estados: filtro.estado ? [filtro.estado] : [],
  })

  return {
    pestana, setPestana,
    estado, setEstado,
    periodo, setPeriodo,
    busqueda, setBusqueda,
    ventas: items,
    contador,
    ventasQuery: ventas,
    /** Deslizar para actualizar trae de nuevo la lista y su resumen, para que el contador no quede viejo. */
    refrescar: () => Promise.all([ventas.refetch(), resumen.refetch()]),
    borradores: borradores.data ?? [],
    borradoresQuery: borradores,
  }
}
