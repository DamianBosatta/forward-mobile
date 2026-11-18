import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from './client'
import type { StockItem, PagedResult } from './types'

/** Consultas de stock de la pantalla de Inventario (resumen, lista, movimientos, valor, rentabilidad). */
export const stockConsultaKeys = {
  all: ['stock-consulta'] as const,
}

export const stockKeys = {
  all: ['stock'] as const,
  lists: () => [...stockKeys.all, 'list'] as const,
  list: (params: StockParams) => [...stockKeys.lists(), params] as const,
}

export interface StockParams {
  pageNumber?: number
  pageSize?: number
  depositoId?: string
  productoId?: string
  activo?: boolean | null
  search?: string
}

export function useStock(params: StockParams = {}, { enabled = true } = {}) {
  const searchParams = new URLSearchParams()
  if (params.pageNumber) searchParams.set('pageNumber', String(params.pageNumber))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.depositoId) searchParams.set('depositoId', params.depositoId)
  if (params.productoId) searchParams.set('productoId', params.productoId)
  if (params.activo !== undefined && params.activo !== null) searchParams.set('activo', String(params.activo))
  if (params.search) searchParams.set('searchTerm', params.search)

  return useQuery({
    queryKey: stockKeys.list(params),
    queryFn: () => api.get<PagedResult<StockItem>>(`/api/v1/Stocks?${searchParams}`),
    enabled,
  })
}

export interface DisponibilidadItem {
  productoId: string
  disponible: boolean
}

export interface DisponibilidadPedido {
  productoId: string
  cantidad: number
}

/** POST /Stocks/disponibilidad: (actual - reservado) >= cantidad, un booleano por producto. */
export function fetchDisponibilidad(depositoId: string, items: DisponibilidadPedido[]) {
  return api.post<DisponibilidadItem[]>('/api/v1/Stocks/disponibilidad', { depositoId, items })
}

const disponibilidadKey = (depositoId: string, items: DisponibilidadPedido[]) =>
  [...stockKeys.all, 'disponibilidad', depositoId, items] as const

/**
 * ¿Se puede vender la cantidad pedida de cada producto en el depósito? El servidor descuenta lo
 * reservado y responde un booleano por producto, nunca la cantidad (PR 3.1).
 */
export function useDisponibilidad(depositoId: string, items: DisponibilidadPedido[]) {
  return useQuery({
    queryKey: disponibilidadKey(depositoId, items),
    queryFn: () => fetchDisponibilidad(depositoId, items),
    enabled: items.length > 0,
    staleTime: 60_000,
  })
}

/** Igual, pero una consulta por lote (una página del listado): al cargar otra solo se pide la nueva. */
export function useDisponibilidadPorLotes(depositoId: string, lotes: DisponibilidadPedido[][]) {
  return useQueries({
    queries: lotes.map((items) => ({
      queryKey: disponibilidadKey(depositoId, items),
      queryFn: () => fetchDisponibilidad(depositoId, items),
      enabled: items.length > 0,
      staleTime: 60_000,
    })),
  })
}
