import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { StockItem, MovimientoStockHistorialDto, PagedResult, AjusteStockRequest } from './types'
import { productosKeys } from './productos'

export const stockKeys = {
  all: ['stock'] as const,
  lists: () => [...stockKeys.all, 'list'] as const,
  list: (params: any) => [...stockKeys.lists(), params] as const,
  movimientos: (productoId: string, params?: any) =>
    [...stockKeys.all, 'movimientos', productoId, params] as const,
}

export interface StockParams {
  pageNumber?: number
  pageSize?: number
  depositoId?: string
  productoId?: string
  activo?: boolean | null
  search?: string
}

export function useStock(params: StockParams = {}) {
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
  })
}

export function useInfiniteStock(params: StockParams = {}) {
  return useInfiniteQuery({
    queryKey: [...stockKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('pageNumber', String(pageParam))
      searchParams.set('pageSize', String(params.pageSize ?? 20))
      if (params.depositoId) searchParams.set('depositoId', params.depositoId)
      if (params.productoId) searchParams.set('productoId', params.productoId)
      if (params.activo !== undefined && params.activo !== null) searchParams.set('activo', String(params.activo))
      if (params.search) searchParams.set('searchTerm', params.search)
      
      return api.get<PagedResult<StockItem>>(`/api/v1/Stocks?${searchParams}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1
      }
      return undefined
    },
    staleTime: 5 * 60_000,
  })
}

export interface MovimientosStockParams {
  productoId: string
  depositoId?: string
  pageNumber?: number
  pageSize?: number
}

/**
 * Fetches the stock movement history for a product.
 * Maps to GET /api/v1/stocks/movimientos.
 * Disabled when productoId is empty.
 */
export function useMovimientosStock(params: MovimientosStockParams) {
  const { productoId, depositoId, pageNumber = 1, pageSize = 20 } = params

  const searchParams = new URLSearchParams()
  if (productoId) searchParams.set('productoId', productoId)
  if (depositoId) searchParams.set('depositoId', depositoId)
  searchParams.set('pageNumber', String(pageNumber))
  searchParams.set('pageSize', String(pageSize))

  return useQuery({
    queryKey: stockKeys.movimientos(productoId, { depositoId, pageNumber, pageSize }),
    queryFn: () =>
      api.get<PagedResult<MovimientoStockHistorialDto>>(
        `/api/v1/Stocks/movimientos?${searchParams}`,
      ),
    enabled: Boolean(productoId),
    staleTime: 60_000,
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
