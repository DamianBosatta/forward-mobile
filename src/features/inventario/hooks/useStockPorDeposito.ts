import { useMemo, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import type { PagedResult, StockItem } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'
import type { FiltroEstadoStock } from '../lib/stock-presentacion'

export type StockResumen = components['schemas']['StockResumenResponse']

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/** Filtros que comparten el listado y el resumen de GET /Stocks (el servidor cuenta con los mismos). */
function filtros(depositoId: string, termino: string, estado: FiltroEstadoStock) {
  const p = new URLSearchParams()
  p.set('DepositoId', depositoId)
  p.set('Activo', 'true')
  if (termino) p.set('SearchTerm', termino)
  if (estado !== 'todos') p.append('EstadoStock', estado)
  return p
}

/**
 * Stock por depósito, solo consulta (lámina ModStock). Solo se pide con `conCantidades`
 * (CAP_VER_CANTIDADES_STOCK): sin la capacidad el servidor no las manda y la pantalla no las pide.
 * El depósito arranca en el de consulta del usuario (el suyo o el Central) y se cambia entre los que el servidor
 * lista en el resumen. Los totales (artículos, en alerta, sin stock) los cuenta el servidor; no se suman acá.
 */
export function useStockPorDeposito({ conCantidades, busqueda }: { conCantidades: boolean; busqueda: string }) {
  const depositoDelUsuario = useDepositoDeConsulta()
  const [elegido, setDeposito] = useState<string | null>(null)
  const [estado, setEstado] = useState<FiltroEstadoStock>('todos')
  const depositoId = elegido ?? depositoDelUsuario
  const termino = useDebouncedValue(busqueda.trim(), DEBOUNCE_BUSQUEDA_MS)

  const resumen = useQuery({
    queryKey: ['stock-consulta', 'resumen', depositoId, termino],
    queryFn: () => api.get<StockResumen>(`/api/v1/Stocks/resumen?${filtros(depositoId, termino, 'todos')}`),
    enabled: conCantidades,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const lista = useInfiniteQuery({
    queryKey: ['stock-consulta', 'lista', depositoId, termino, estado],
    queryFn: ({ pageParam = 1 }) => {
      const p = filtros(depositoId, termino, estado)
      p.set('PageNumber', String(pageParam))
      p.set('PageSize', String(TAMANO_PAGINA))
      return api.get<PagedResult<StockItem>>(`/api/v1/Stocks?${p}`)
    },
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.hasNextPage ? ultima.page + 1 : undefined),
    enabled: conCantidades,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const filas = useMemo(() => lista.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [lista.data])

  return {
    depositoId,
    setDeposito,
    depositos: resumen.data?.depositos ?? [],
    totales: resumen.data?.totales,
    estado,
    setEstado,
    filas,
    isLoading: lista.isLoading,
    isError: lista.isError,
    cargarMas: () => {
      if (lista.hasNextPage && !lista.isFetchingNextPage) lista.fetchNextPage()
    },
    isFetchingNextPage: lista.isFetchingNextPage,
  }
}
