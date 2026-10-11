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
import type { components } from './generated/schema'

export type BorradorVenta = components['schemas']['BorradorVentaDto']
export type VentaPendienteAutorizacion = components['schemas']['VentaPendienteAutorizacionDto']

// #region Query Keys
export const ventasKeys = {
  all: ['ventas'] as const,
  lists: () => [...ventasKeys.all, 'list'] as const,
  list: (params: VentaParams) => [...ventasKeys.lists(), params] as const,
  infinite: (params: VentaParams) => [...ventasKeys.all, 'infinite', params] as const,
  details: () => [...ventasKeys.all, 'detail'] as const,
  detail: (id: string) => [...ventasKeys.details(), id] as const,
  borradoresMios: () => [...ventasKeys.all, 'borradores', 'mios'] as const,
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
export function useInfiniteVentas(params: VentaParams = {}, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: ventasKeys.infinite(params),
    enabled: options?.enabled,
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

/**
 * Borradores con autoguardado del usuario logueado: los últimos 5 con actividad en las
 * últimas 48 h (los más viejos el servidor no los devuelve). Lista corta, sin paginar.
 */
export function useBorradoresVentaMios(enabled = true) {
  return useQuery({
    queryKey: ventasKeys.borradoresMios(),
    queryFn: () => api.get<BorradorVenta[]>('/api/v1/Ventas/borradores/mios'),
    enabled,
    staleTime: 30_000,
  })
}

/** `fresco`: siempre trae de nuevo al montar (para actuar sobre la versión vigente, no sobre el caché). */
export function useVenta(id: string, opciones: { fresco?: boolean } = {}) {
  return useQuery({
    queryKey: ventasKeys.detail(id),
    queryFn: () => api.get<VentaDetalleDto>(`/api/v1/Ventas/${id}`),
    enabled: !!id,
    staleTime: opciones.fresco ? 0 : 60_000,
    refetchOnMount: opciones.fresco ? 'always' : true,
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
 * Bandeja de ventas frenadas por autorización: GET /api/v1/Ventas/pendientes-autorizacion.
 * Lista completa (sin paginar), la que más espera primero. Sin CAP_AUTORIZAR_VENTA el servidor
 * contesta 403: `enabled` evita pedirla sin la capacidad.
 */
export function usePendientesAutorizacion(enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.all, 'pendientes-autorizacion'] as const,
    queryFn: () => api.get<VentaPendienteAutorizacion[]>('/api/v1/Ventas/pendientes-autorizacion'),
    staleTime: 30_000,
    enabled,
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

/** Borrador con autoguardado (el de la web): Presupuesto sin líneas; el vendedor sale del token. */
export const useIniciarBorradorVenta = () => useMutation({
  mutationFn: (data: { clienteId: string; depositoId: string }) => api.post<VentaActionResponseDto>('/api/v1/Ventas/borradores', data),
})

/** Autoguardado del borrador: PUT /Ventas/{id} con la versión vigente; devuelve la nueva. */
export function guardarBorradorVenta(id: string, version: number, data: Record<string, unknown>) {
  return api.put<VentaActionResponseDto>(`/api/v1/Ventas/${id}`, { ...data, id, version })
}

export function useDescartarBorradorVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<boolean>(`/api/v1/Ventas/${id}/descartar-borrador`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ventasKeys.borradoresMios() }),
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
 * Versión vigente de la venta para decidir sobre ella. Si cambió desde que se cargó la bandeja
 * (`fechaPendiente` es su fecha de modificación), frena: no se decide sobre algo que no se vio.
 */
export class VentaCambioError extends Error {
  constructor() {
    super('La venta cambió desde que se cargó la lista. Actualizá y revisala antes de decidir.')
    this.name = 'VentaCambioError'
  }
}

/** La venta ya no es la que se vio: la frenó nuestra guarda o el servidor contestó 409. */
export function esConflictoDeVenta(e: unknown): boolean {
  return e instanceof VentaCambioError || (e as { status?: number } | null)?.status === 409
}

async function versionParaDecidir(id: string, fechaPendiente?: string): Promise<number> {
  const d = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${id}`)
  if (fechaPendiente && Date.parse(d.venta.fechaModificacion ?? '') !== Date.parse(fechaPendiente)) {
    throw new VentaCambioError()
  }
  return d.venta.version
}

/**
 * Autoriza una venta por autorizar. Con `version` usa la del detalle que se está viendo; sin
 * ella (desde la bandeja) la pide al servidor. La razón es obligatoria solo con margen en
 * amarillo y la exige el servidor; vacía viaja como null.
 */
export function useAutorizarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, version, razon, fechaPendiente }: { id: string; version?: number; razon?: string | null; fechaPendiente?: string }) =>
      api.post<boolean>(
        `/api/v1/Ventas/${id}/autorizar`,
        buildAutorizarPayload({ ventaId: id, version: version ?? (await versionParaDecidir(id, fechaPendiente)), razon }),
      ),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
    // Con la venta cambiada, el detalle y la bandeja en pantalla quedaron viejos: se vuelven a pedir.
    onError: (e: unknown) => { if (esConflictoDeVenta(e)) queryClient.invalidateQueries({ queryKey: ventasKeys.all }) },
  })
}

/** Rechaza una venta por autorizar. El motivo es obligatorio (lo exige el dominio). */
export function useRechazarAutorizacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, version, motivo, fechaPendiente }: { id: string; version?: number; motivo: string; fechaPendiente?: string }) =>
      api.post<string>(`/api/v1/Ventas/${id}/rechazar-autorizacion`, {
        ventaId: id,
        version: version ?? (await versionParaDecidir(id, fechaPendiente)),
        motivoRechazo: motivo.trim(),
      }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
    onError: (e: unknown) => { if (esConflictoDeVenta(e)) queryClient.invalidateQueries({ queryKey: ventasKeys.all }) },
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
