import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { buildAnularCompraPayload } from './anular-compra'
import type { Compra, CompraDtoList, CompraDto, PagedResult, CreateCompraRequest } from './types'

export const comprasKeys = {
  all: ['compras'] as const,
  lists: () => [...comprasKeys.all, 'list'] as const,
  list: (params: { pageNumber?: number; pageSize?: number }) => [...comprasKeys.lists(), params] as const,
  infinite: (params: { pageSize?: number }) => [...comprasKeys.all, 'infinite', params] as const,
  details: () => [...comprasKeys.all, 'detail'] as const,
  detail: (id: string) => [...comprasKeys.details(), id] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useCompras(params: { pageNumber?: number; pageSize?: number } = {}) {
  const { pageNumber = 1, pageSize = 20 } = params
  return useQuery({
    queryKey: comprasKeys.list(params),
    queryFn: () => api.get<PagedResult<CompraDtoList>>(`/api/v1/Compras?pageNumber=${pageNumber}&pageSize=${pageSize}`),
  })
}

/**
 * Hook para scroll infinito en lista de compras
 */
export function useInfiniteCompras(params: { pageSize?: number } = {}) {
  return useInfiniteQuery({
    queryKey: comprasKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const pageSize = params.pageSize ?? 20
      return api.get<PagedResult<CompraDtoList>>(`/api/v1/Compras?pageNumber=${pageParam}&pageSize=${pageSize}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1
      }
      return undefined
    },
    staleTime: 30_000,
  })
}

/** Full detail projection — matches GET /api/v1/compras/{id} shape (includes detalles). */
export function useCompra(id: string) {
  return useQuery({
    queryKey: comprasKeys.detail(id),
    queryFn: () => api.get<CompraDto>(`/api/v1/Compras/${id}`),
    enabled: !!id,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCompraRequest) => api.post<Compra>('/api/v1/Compras', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

export function useUpdateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCompraRequest }) =>
      api.put<Compra>(`/api/v1/Compras/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
      queryClient.invalidateQueries({ queryKey: comprasKeys.detail(variables.id) })
    },
  })
}

export function useCancelarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo = 'Cancelado desde app' }: { id: string; motivo?: string }) =>
      api.delete<void>(`/api/v1/Compras/${id}/anular`, buildAnularCompraPayload(motivo)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

export function useConfirmarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/api/v1/Compras/${id}/confirmar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

export function useRecibirCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/api/v1/Compras/${id}/recibir`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}
