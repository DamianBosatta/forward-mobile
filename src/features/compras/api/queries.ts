import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/libs/api-client/client'
import { buildAnularCompraPayload } from '@/libs/api-client/anular-compra'
import type { Compra, CompraDto, PagedResult, CreateCompraRequest } from '@/libs/api-client/types'
// #region Query Keys
// ─────────────────────────────────────────────────────────────────────────────
export const comprasKeys = {
  all: ['compras'] as const,
  lists: () => [...comprasKeys.all, 'list'] as const,
  list: (params: { pageNumber?: number; pageSize?: number }) => [...comprasKeys.lists(), params] as const,
  details: () => [...comprasKeys.all, 'detail'] as const,
  detail: (id: string) => [...comprasKeys.details(), id] as const,
}
// #endregion

// #region Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene una lista paginada de compras.
 * @param params Parámetros de paginación
 */
export function useCompras(params: { pageNumber?: number; pageSize?: number } = {}) {
  const { pageNumber = 1, pageSize = 20 } = params
  return useQuery({
    queryKey: comprasKeys.list(params),
    staleTime: 0,              // Siempre marcar como stale al volver a la pantalla
    refetchOnMount: 'always',  // Re-fetchear al montar aunque el cache exista
    queryFn: async () => {
      const res = await api.get<PagedResult<Compra>>(`/api/v1/compras?pageNumber=${pageNumber}&pageSize=${pageSize}`)
      const items = (res.items ?? []).map((c: Compra) => ({
        ...c,
        itemsCount: c.itemsCount ?? 0,
      }))
      return { ...res, items }
    },
  })
}

/**
 * Obtiene los detalles de una compra específica por su ID.
 * @param id Identificador de la compra
 */
export function useCompra(id: string) {
  return useQuery({
    queryKey: comprasKeys.detail(id),
    queryFn: async () => {
      const res = await api.get<CompraDto>(`/api/v1/compras/${id}`)
      return res
    },
    enabled: !!id,
  })
}
// #endregion

// #region Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea una nueva orden de compra.
 */
export function useCreateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCompraRequest) => {
      const res = await api.post<Compra>('/api/v1/compras', data)
      return res
    },
    onSuccess: () => {
      // Invalidar Y forzar refetch inmediato para que al volver la lista esté fresca
      queryClient.invalidateQueries({ queryKey: comprasKeys.lists() })
      queryClient.refetchQueries({ queryKey: comprasKeys.lists() })
    },
  })
}

/**
 * Actualiza los datos de una compra existente.
 */
export function useUpdateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateCompraRequest }) => {
      const res = await api.put<Compra>(`/api/v1/compras/${id}`, data)
      return res
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
      queryClient.invalidateQueries({ queryKey: comprasKeys.detail(variables.id) })
    },
  })
}

/**
 * Cancela una compra especificando el motivo.
 */
export function useCancelarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo = 'Cancelado desde app' }: { id: string; motivo?: string }) =>
      api.delete<void>(`/api/v1/compras/${id}/anular`, buildAnularCompraPayload(motivo)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

/**
 * Confirma una orden de compra (pasa de Presupuesto a Confirmada).
 */
export function useConfirmarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<void>(`/api/v1/compras/${id}/confirmar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

/**
 * Marca una compra confirmada como Recibida (ingresa stock).
 */
export function useRecibirCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<void>(`/api/v1/compras/${id}/recibir`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

// #endregion
