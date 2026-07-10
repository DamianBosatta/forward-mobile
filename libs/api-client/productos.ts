import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Producto, ProductoDetailDto, PagedResult, CreateProductoRequest, UpdateProductoRequest } from './types'
import type { components } from './generated/schema'

export const productosKeys = {
  all: ['productos'] as const,
  lists: () => [...productosKeys.all, 'list'] as const,
  list: (params: ProductoParams) => [...productosKeys.lists(), params] as const,
  infinite: (params: ProductoParams) => [...productosKeys.all, 'infinite', params] as const,
  detail: (id: string) => [...productosKeys.all, 'detail', id] as const,
}

export interface ProductoParams {
  pageNumber?: number
  pageSize?: number
  search?: string
  soloActivos?: boolean
}

// CatalogoStockItem derived from generated OpenAPI schema — do not hand-edit.
export type CatalogoStockItem = components['schemas']['CatalogoStockRealDto']

// ADR-4: per-warehouse stock breakdown inside CatalogoStockItem.almacenes[].
// Additive — existing consumers of CatalogoStockItem are unaffected.
export type AlmacenStockItem = components['schemas']['AlmacenStockDto']

export function useCatalogoStock(depositoId?: string) {
  const searchParams = new URLSearchParams()
  if (depositoId) searchParams.set('depositoId', depositoId)

  return useQuery({
    queryKey: [...productosKeys.all, 'catalogoStock', depositoId],
    queryFn: () => api.get<CatalogoStockItem[]>(`/api/v1/Productos/catalogo-stock?${searchParams}`),
    staleTime: 60_000,
  })
}

export function useProductos(params: ProductoParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.pageNumber) searchParams.set('pageNumber', String(params.pageNumber))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.search) searchParams.set('searchTerm', params.search)
  if (params.soloActivos !== undefined) searchParams.set('soloActivos', String(params.soloActivos))

  return useQuery({
    queryKey: productosKeys.list(params),
    queryFn: () => api.get<PagedResult<Producto>>(`/api/v1/Productos?${searchParams}`),
    staleTime: 5 * 60_000,
  })
}

/**
 * Hook para scroll infinito en lista de productos
 */
export function useInfiniteProductos(params: ProductoParams = {}) {
  return useInfiniteQuery({
    queryKey: productosKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('pageNumber', String(pageParam))
      searchParams.set('pageSize', String(params.pageSize ?? 20))
      if (params.search) searchParams.set('searchTerm', params.search)
      if (params.soloActivos !== undefined) searchParams.set('soloActivos', String(params.soloActivos))

      return api.get<PagedResult<Producto>>(`/api/v1/Productos?${searchParams}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1
      }
      return undefined
    },
    staleTime: 5 * 60_000,
  })
}

export function useProducto(id: string) {
  return useQuery({
    queryKey: productosKeys.detail(id),
    queryFn: () => api.get<ProductoDetailDto>(`/api/v1/Productos/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

export function useCreateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProductoRequest) => api.post<Producto>('/api/v1/Productos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productosKeys.all }),
  })
}

export function useUpdateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProductoRequest) => api.put<Producto>(`/api/v1/Productos/${data.id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productosKeys.all })
      queryClient.invalidateQueries({ queryKey: productosKeys.detail(variables.id) })
    },
  })
}

/**
 * Update Optimista para Toggle Status de Producto
 */
export function useToggleProductoStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => 
      api.put<boolean>(`/api/v1/Productos/${id}/toggle-status`, { activo }),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: productosKeys.all })
      const previousData = queryClient.getQueryData(productosKeys.all)

      queryClient.setQueriesData({ queryKey: productosKeys.all }, (old: any) => {
        if (!old) return old

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: {
                ...page.data,
                items: page.data?.items?.map((p: any) =>
                  p.id === variables.id ? { ...p, activo: variables.activo } : p
                )
              },
              items: page.items?.map((p: any) =>
                p.id === variables.id ? { ...p, activo: variables.activo } : p
              )
            }))
          }
        }

        if (old.data?.items) {
           return {
             ...old,
             data: {
               ...old.data,
               items: old.data.items.map((p: any) => p.id === variables.id ? { ...p, activo: variables.activo } : p)
             }
           }
        }

        if (Array.isArray(old)) {
           return old.map((p: any) => p.id === variables.id ? { ...p, activo: variables.activo } : p)
        }

        if (old.id === variables.id) {
           return { ...old, activo: variables.activo }
        }

        return old
      })

      return { previousData }
    },

    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(productosKeys.all, context.previousData)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productosKeys.all })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}
