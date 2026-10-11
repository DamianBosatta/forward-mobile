import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
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

/**
 * ¿Hay al menos una unidad para vender de cada producto en el depósito? El servidor responde
 * un booleano por producto, nunca la cantidad (PR 3.1: el vendedor ve disponibilidad).
 */
export function useDisponibilidad(depositoId: string | undefined, productoIds: string[]) {
  return useQuery({
    queryKey: [...stockKeys.all, 'disponibilidad', depositoId, productoIds] as const,
    queryFn: () =>
      api.post<DisponibilidadItem[]>('/api/v1/Stocks/disponibilidad', {
        depositoId,
        items: productoIds.map((productoId) => ({ productoId, cantidad: 1 })),
      }),
    enabled: !!depositoId && productoIds.length > 0,
    // Al cargar otra página la lista de ids cambia: se mantienen los chips ya conocidos.
    placeholderData: keepPreviousData,
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
