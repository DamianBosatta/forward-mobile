import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, API_URL } from './client'
import { buildAnularVentaPayload } from './anular-venta'
import { buildAutorizarPayload } from '@/features/ventas/lib/authorization'
import type {
  Venta,
  VentaDetailResponse,
  CreateVentaRequest,
  PagedResult,
  EstadoVenta,
  VentaActionResponseDto,
  EmpacarVentaResponseDto,
  VentaDetalleDto,
  AutorizacionPreviewDto,
  AutorizarVentaCommand,
} from './types'

// #region Query Keys
export const ventasKeys = {
  all: ['ventas'] as const,
  lists: () => [...ventasKeys.all, 'list'] as const,
  list: (params: VentaParams) => [...ventasKeys.lists(), params] as const,
  infinite: (params: VentaParams) => [...ventasKeys.all, 'infinite', params] as const,
  details: () => [...ventasKeys.all, 'detail'] as const,
  detail: (id: string) => [...ventasKeys.details(), id] as const,
  resumen: (params: VentasResumenParams) => [...ventasKeys.all, 'resumen', params] as const,
}

export interface VentaParams {
  pageNumber?: number
  pageSize?: number
  estado?: EstadoVenta
  clienteId?: string
  fechaDesde?: string
  fechaHasta?: string
  ticketId?: string
  tipoOperacion?: number
  searchTerm?: string
}

export interface VentasResumenDto {
  totalVendido: number
  pendientes: number
  porAutorizar: number
  entregadas: number
}

export interface VentasResumenParams {
  fechaDesde?: string
  fechaHasta?: string
  clienteId?: string
  searchTerm?: string
}
// #endregion

// #region Queries

/**
 * Hook para obtener ventas paginadas (Carga simple)
 */
export function useVentas(params: VentaParams = {}, options?: { enabled?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params.pageNumber) searchParams.set('pageNumber', String(params.pageNumber))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.estado) searchParams.set('estado', params.estado)
  if (params.clienteId) searchParams.set('clienteId', params.clienteId)
  if (params.fechaDesde) searchParams.set('fechaDesde', params.fechaDesde)
  if (params.fechaHasta) searchParams.set('fechaHasta', params.fechaHasta)
  if (params.ticketId) searchParams.set('ticketId', params.ticketId)
  if (params.tipoOperacion !== undefined) searchParams.set('tipoOperacion', String(params.tipoOperacion))

  return useQuery({
    queryKey: ventasKeys.list(params),
    queryFn: () => api.get<PagedResult<Venta>>(`/api/v1/Ventas?${searchParams}`),
    staleTime: 30_000,
    enabled: options?.enabled,
  })
}

/**
 * Hook para scroll infinito en listas de ventas (Recomendado para Móvil)
 */
export function useInfiniteVentas(params: VentaParams = {}) {
  return useInfiniteQuery({
    queryKey: ventasKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('pageNumber', String(pageParam))
      searchParams.set('pageSize', String(params.pageSize ?? 20))
      if (params.estado) searchParams.set('estado', params.estado)
      if (params.clienteId) searchParams.set('clienteId', params.clienteId)
      if (params.fechaDesde) searchParams.set('fechaDesde', params.fechaDesde)
      if (params.fechaHasta) searchParams.set('fechaHasta', params.fechaHasta)
      if (params.tipoOperacion !== undefined) searchParams.set('tipoOperacion', String(params.tipoOperacion))
      if (params.searchTerm) searchParams.set('searchTerm', params.searchTerm)

      return api.get<PagedResult<Venta>>(`/api/v1/Ventas?${searchParams}`)
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

export function useVenta(id: string) {
  return useQuery({
    queryKey: ventasKeys.detail(id),
    queryFn: () => api.get<VentaDetalleDto>(`/api/v1/Ventas/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  })
}

/**
 * Authorization preview for a below-floor venta (PR-2e-b).
 * Returns the per-item sacrificio breakdown and totals. Role-gated server-side
 * to cost roles (Administrador/AdministradorSistemas/Gerente). staleTime 0 so the
 * preview is always fresh when the authorization modal opens.
 */
export function useAutorizacionPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.detail(id), 'autorizacion-preview'] as const,
    queryFn: () => api.get<AutorizacionPreviewDto>(`/api/v1/Ventas/${id}/autorizacion-preview`),
    enabled: !!id && enabled,
    staleTime: 0,
  })
}

/**
 * Hook para obtener el resumen de ventas (totales, pendientes, entregadas).
 * GET /api/v1/Ventas/resumen — parámetros en PascalCase según la OpenAPI spec.
 */
export function useVentasResumen(params: VentasResumenParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.fechaDesde) searchParams.set('FechaDesde', params.fechaDesde)
  if (params.fechaHasta) searchParams.set('FechaHasta', params.fechaHasta)
  if (params.clienteId) searchParams.set('ClienteId', params.clienteId)
  if (params.searchTerm) searchParams.set('SearchTerm', params.searchTerm)

  return useQuery({
    queryKey: ventasKeys.resumen(params),
    queryFn: () => api.get<VentasResumenDto>(`/api/v1/Ventas/resumen?${searchParams}`),
    staleTime: 30_000,
  })
}
// #endregion

// #region Mutations

export function useCreateVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateVentaRequest) =>
      api.post<Venta>('/api/v1/Ventas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function useEntregarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, usuarioModificadorId }: { id: string; version: number; usuarioModificadorId: string }) =>
      api.put<VentaActionResponseDto>(`/api/v1/Logistica/${id}/entregar`, { version, usuarioModificadorId }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function useConvertirPresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, usuarioGeneradorId }: { id: string; version: number; usuarioGeneradorId: string }) =>
      api.put<void>(`/api/v1/Ventas/${id}/convertir-a-pedido`, { version, usuarioGeneradorId }),
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function useAnularVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, motivoAnulacion }: { id: string; version: number; motivoAnulacion: string }) =>
      api.delete<void>(`/api/v1/Ventas/${id}`, buildAnularVentaPayload(version, motivoAnulacion)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

/**
 * Authorize a below-floor venta (PR-2e-b). The server derives actor identity and
 * authorizing role from the JWT token. `razon` is mandatory server-side when any
 * item is below floor. On success, refreshes the venta detail (estado leaves
 * PendienteAutorizacion) and the lists.
 */
export function useAutorizarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, razon }: { id: string; version: number; razon: string }) =>
      api.post<boolean>(
        `/api/v1/Ventas/${id}/autorizar`,
        buildAutorizarPayload({ ventaId: id, version, razon }),
      ),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function useUpdateVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, data }: { id: string; version: number; data: Partial<CreateVentaRequest> }) =>
      api.put<Venta>(`/api/v1/Ventas/${id}`, { ...data, version }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function useEmpacarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, cantidadBultos, usuarioModificadorId }: { id: string; version: number; cantidadBultos: number; usuarioModificadorId: string }) =>
      api.post<EmpacarVentaResponseDto>(`/api/v1/Logistica/${id}/empacar`, { version, cantidadBultos, usuarioModificadorId }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}

export function getNotaEntregaUrl(id: string) {
  return `${API_URL}/api/v1/Logistica/${id}/nota-entrega-pdf`
}

export function getEtiquetasUrl(id: string) {
  return `${API_URL}/api/v1/Logistica/${id}/etiquetas-pdf`
}
// #endregion
