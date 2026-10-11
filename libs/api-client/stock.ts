import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { StockItem, PagedResult, AjusteStockRequest } from './types'
import { productosKeys } from './productos'

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

/**
 * Hook Senior con Updates Optimistas para Ajuste de Stock.
 * Actualiza tanto la lista de stock como la lista de productos (catálogo) localmente.
 */
export function useAjustarStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AjusteStockRequest) =>
      api.post<boolean>('/api/v1/Stocks/adjust', data),

    onMutate: async (variables) => {
      // Cancelar refetches salientes para no sobrescribir nuestro update optimista
      await queryClient.cancelQueries({ queryKey: productosKeys.all })
      await queryClient.cancelQueries({ queryKey: stockKeys.all })

      // Snapshot del estado previo
      const prevProductos = queryClient.getQueryData(productosKeys.all)

      // Update optimista en las queries infinitas de productos
      queryClient.setQueriesData({ queryKey: productosKeys.all }, (old: any) => {
        if (!old) return old

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: {
                ...page.data,
                content: page.data?.content?.map((p: any) => {
                  if (p.id === variables.productoId) {
                    return { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad }
                  }
                  return p
                }),
                items: page.data?.items?.map((p: any) => {
                  if (p.id === variables.productoId) {
                    return { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad }
                  }
                  return p
                })
              },
              // Fallback para estructuras aplanadas
              content: page.content?.map((p: any) => {
                if (p.id === variables.productoId) {
                  return { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad }
                }
                return p
              }),
              items: page.items?.map((p: any) => {
                if (p.id === variables.productoId) {
                  return { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad }
                }
                return p
              })
            }))
          }
        }

        if (old.data?.items) {
           return {
             ...old,
             data: {
               ...old.data,
               items: old.data.items.map((p: any) => p.id === variables.productoId ? { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad } : p)
             }
           }
        }

        if (Array.isArray(old)) {
           return old.map((p: any) => p.id === variables.productoId ? { ...p, stockTotal: (p.stockTotal || 0) + variables.cantidad } : p)
        }

        if (old.id === variables.productoId) {
           return { ...old, stockTotal: (old.stockTotal || 0) + variables.cantidad }
        }

        return old
      })

      return { prevProductos }
    },

    onError: (err, variables, context) => {
      // Rollback al estado anterior si falla
      if (context?.prevProductos) {
        queryClient.setQueryData(productosKeys.all, context.prevProductos)
      }
    },

    onSettled: () => {
      // Invalidar para sincronizar con la verdad del servidor
      queryClient.invalidateQueries({ queryKey: stockKeys.all })
      queryClient.invalidateQueries({ queryKey: productosKeys.all })
    },
  })
}
