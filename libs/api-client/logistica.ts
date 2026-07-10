/**
 * logistica.ts — API hooks for the logistics module.
 *
 * Authoritative contract = web packages/api-client/src/picking.ts + logistica.ts
 * (verified against LogisticaController.cs).
 *
 * Reconciliation (PR0):
 *   - DELETED stale hooks: useEmpacarMasivo (/empacar-masivo), useEnviarARutaMasivo (/enviar-a-ruta-masivo)
 *   - ADDED: useIniciarPreparacion, useEmpacarVenta, useRevertirAPreparacion, useRevertirAConfirmada
 *   - FIXED: useCrearHojaRuta now includes depositoId
 *   - FIXED: useVentasParaPreparacion now uses PascalCase query params
 *   - ADDED: VentaPreparacion.metodoEntrega field
 *   - ADDED: useCreateVehiculo, useUpdateVehiculo, useDeactivateVehiculo
 *   - ADDED: pickingKeys query-key namespace
 *   - ADDED: URL builders getManifiestoUrl, getEtiquetasUrl, getSurtidoPdfUrl
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { api, API_URL } from './client'
import type { Vehiculo as VehiculoDto, VentaEmpacada, Chofer, Vehiculo, HojaDeRuta, HojaRutaListItemDto } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────────────────────

export const logisticaKeys = {
  all: ['logistica'] as const,
  ventasEmpacadas: () => [...logisticaKeys.all, 'ventas-empacadas'] as const,
  choferes: () => [...logisticaKeys.all, 'choferes'] as const,
  vehiculos: () => [...logisticaKeys.all, 'vehiculos'] as const,
  hojasRuta: () => [...logisticaKeys.all, 'hojas-ruta'] as const,
  hojaRuta: (id: string) => [...logisticaKeys.all, 'hojas-ruta', id] as const,
}

/** Isolated query-key namespace for the picking board. Keeps picking invalidations
 *  from affecting viajes queries and vice versa. */
export const pickingKeys = {
  all: ['picking', 'board'] as const,
  list: (params: VentasPreparacionParams) => [...pickingKeys.all, params] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs (hand-written to match backend — openapi.json predates Batch 1 endpoints)
// ─────────────────────────────────────────────────────────────────────────────

export interface SkippedItem {
  ventaId: string
  reason: string
}

export interface IniciarPreparacionMasivaResult {
  advanced: string[]
  skipped: SkippedItem[]
}

/** Params for useVentasParaPreparacion. Query params use PascalCase to match backend. */
export interface VentasPreparacionParams {
  fechaDesde?: string
  fechaHasta?: string
  metodoEntrega?: number
  ticketId?: string
}

/**
 * VentaPreparacion — matches VentaPreparacionDto in backend.
 * All fields except fechaEntrega are [Required] in the contract (always sent by the backend).
 */
export interface VentaPreparacion {
  id: string
  clienteNombre: string
  direccion: string
  fechaEntrega: string | null
  /** EstadoVenta int: 2=Confirmada, 3=EnPreparacion, 4=Empacada */
  estado: number
  /** MetodoEntrega int: 1=LogisticaPropia, 2=RetiroEnLocal. Required: NOT NULL en la BD. */
  metodoEntrega: number
  itemsCount: number
  /** Concurrency token (xmin). Used by Empacar for optimistic concurrency. */
  version: number
}

/** Write payload for create/update. Subset of VehiculoDto without the server-owned id. */
export interface VehiculoCrudPayload {
  patente: string
  modelo: string
  capacidadCargaKg: number
}

/**
 * Read shape for the CRUD list/cards.
 *
 * id/patente/modelo/capacidadCargaKg come from the generated VehiculoDto (now
 * required in the contract). `activo` is hand-written because the backend list
 * endpoint (GET /vehiculos) does NOT return it — it filters to active vehicles
 * server-side, so this field is effectively always true on the wire and is kept
 * only to drive the optional "inactive" UI affordance. Reconciling it away would
 * require a backend response-DTO change, which is out of scope for this refactor.
 */
export interface VehiculoCrudResult extends VehiculoDto {
  activo?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Builders (no hooks — consumed by sharePdf)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/Logistica/hojas-ruta/{id}/manifiesto-pdf */
export function getManifiestoUrl(id: string): string {
  return `${API_URL}/api/v1/Logistica/hojas-ruta/${id}/manifiesto-pdf`
}

/** GET /api/v1/logistica/etiquetas-masivas-pdf?ventaIds=a,b,c */
// NOTE: getEtiquetasUrl (single venta) is exported from ventas.ts — same URL, no need to duplicate.

export function getEtiquetasMasivasUrl(ventaIds: string[]): string {
  return `${API_URL}/api/v1/Logistica/etiquetas-masivas-pdf?ventaIds=${ventaIds.join(',')}`
}

/** POST /api/v1/logistica/lista-surtido-pdf (body { ventaIds }) — used with sharePdf POST extension */
export function getSurtidoPdfUrl(): string {
  return `${API_URL}/api/v1/logistica/lista-surtido-pdf`
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export function useVentasEmpacadas() {
  return useQuery({
    queryKey: logisticaKeys.ventasEmpacadas(),
    queryFn: () => api.get<VentaEmpacada[]>('/api/v1/Logistica/ventas-empacadas')
  })
}

export function useChoferes() {
  return useQuery({
    queryKey: logisticaKeys.choferes(),
    queryFn: () => api.get<Chofer[]>('/api/v1/Logistica/choferes')
  })
}

export function useVehiculos() {
  return useQuery({
    queryKey: logisticaKeys.vehiculos(),
    queryFn: () => api.get<Vehiculo[]>('/api/v1/Logistica/vehiculos')
  })
}

// GET /api/v1/Logistica/hojas-ruta returns the LIST shape (HojaRutaListItemDto with
// cantidadParadas, no detalles) — NOT the detail shape. Typed accordingly so consumers
// read cantidadParadas directly without an `as any` cast.
export function useHojasDeRuta(
  filters?: { choferId?: string, estado?: number },
  options?: Omit<UseQueryOptions<HojaRutaListItemDto[], Error>, 'queryKey' | 'queryFn'>
) {
  const searchParams = new URLSearchParams()
  if (filters?.choferId) searchParams.set('choferId', filters.choferId)
  if (filters?.estado !== undefined) searchParams.set('estado', String(filters.estado))

  return useQuery({
    queryKey: [...logisticaKeys.hojasRuta(), filters],
    queryFn: () => api.get<HojaRutaListItemDto[]>(`/api/v1/Logistica/hojas-ruta?${searchParams}`),
    staleTime: 30_000,
    ...options
  })
}

export function useHojaRuta(id: string) {
  return useQuery({
    queryKey: logisticaKeys.hojaRuta(id),
    queryFn: () => api.get<HojaDeRuta>(`/api/v1/Logistica/hojas-ruta/${id}`),
    enabled: !!id
  })
}

/**
 * Fetches ventas for the warehouse picking board filtered by delivery date and method.
 * Results are partitioned client-side into 3 sections by estado (2/3/4) via partitionByEstado.
 *
 * Query params are PascalCase to match backend GetVentasParaPreparacionQuery.cs.
 */
export function useVentasParaPreparacion(params?: VentasPreparacionParams) {
  const searchParams = new URLSearchParams()
  if (params?.fechaDesde) searchParams.set('FechaDesde', params.fechaDesde)
  if (params?.fechaHasta) searchParams.set('FechaHasta', params.fechaHasta)
  if (params?.metodoEntrega != null) searchParams.set('MetodoEntrega', String(params.metodoEntrega))
  if (params?.ticketId) searchParams.set('TicketId', params.ticketId)

  return useQuery({
    queryKey: pickingKeys.list(params ?? {}),
    queryFn: () => api.get<VentaPreparacion[]>(`/api/v1/Logistica/ventas-para-preparacion?${searchParams}`),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — Hoja de Ruta lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export function useCrearHojaRuta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      choferId: string
      vehiculoId: string
      fechaSalida: string
      usuarioGeneradorId: string
      depositoId?: string | null
      paradas: { ventaId: string; latitud?: number; longitud?: number; direccionDestino?: string | null }[]
    }) => api.post<string>('/api/v1/Logistica/hojas-ruta', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.all })
    }
  })
}

export function useIniciarHojaRuta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<string>(`/api/v1/Logistica/hojas-ruta/${id}/iniciar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.all })
    }
  })
}

export function useReportarParada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      hojaDeRutaId: string
      paradaId: string
      entregado: boolean
      motivoRechazo?: string
      evidenciaUrl?: string
      observaciones?: string
    }) => api.post<void>(`/api/v1/Logistica/hojas-ruta/${payload.hojaDeRutaId}/reportar-parada`, payload),
    onSuccess: (_, { hojaDeRutaId }) => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.hojaRuta(hojaDeRutaId) })
    }
  })
}

export function useFinalizarHojaRuta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/api/v1/Logistica/hojas-ruta/${id}/finalizar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.all })
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — Picking Board (Batch 1 endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advances selected ventas from Confirmada(2) to EnPreparacion(3).
 * Handles N=1 and N>1. Non-Confirmada ventas are skipped and reported in result.
 * Invalidates the picking board on success.
 */
export function useIniciarPreparacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ventaIds: string[]) =>
      api.post<IniciarPreparacionMasivaResult>(
        '/api/v1/logistica/iniciar-preparacion-masiva',
        { ventaIds },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pickingKeys.all })
    },
  })
}

/**
 * Empaca a venta (EnPreparacion → Empacada) — picking board variant.
 * Requires cantidadBultos ≥ 1. Sends the version token for optimistic concurrency.
 * Invalidates the picking board on success.
 *
 * NOTE: Named usePickingEmpacarVenta to avoid collision with the ventas-module
 * useEmpacarVenta (which has a different signature including usuarioModificadorId).
 */
export function usePickingEmpacarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ventaId, cantidadBultos, version }: { ventaId: string; cantidadBultos: number; version: number }) =>
      api.post<unknown>(`/api/v1/logistica/${ventaId}/empacar`, { cantidadBultos, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pickingKeys.all })
    },
  })
}

/**
 * Reverts a packed venta (Empacada) back to EnPreparacion.
 * DESTRUCTIVE: previously created bultos/etiquetas are removed in the backend.
 * Invalidates the picking board on success.
 */
export function useRevertirAPreparacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ventaId: string) =>
      api.post<boolean>(`/api/v1/logistica/${ventaId}/revertir-preparacion`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pickingKeys.all })
    },
  })
}

/**
 * Reverts a venta in EnPreparacion back to Confirmada.
 * Invalidates the picking board on success.
 */
export function useRevertirAConfirmada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ventaId: string) =>
      api.post<boolean>(`/api/v1/logistica/${ventaId}/revertir-confirmada`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pickingKeys.all })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — Vehiculos CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new vehicle. Management-only.
 * Invalidates the vehiculos list on success.
 */
export function useCreateVehiculo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: VehiculoCrudPayload) =>
      api.post<VehiculoCrudResult>('/api/v1/Logistica/vehiculos', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.vehiculos() })
    },
  })
}

/**
 * Updates an existing vehicle. Management-only.
 * Invalidates the vehiculos list on success.
 */
export function useUpdateVehiculo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: VehiculoCrudPayload & { id: string }) =>
      api.put<VehiculoCrudResult>(`/api/v1/Logistica/vehiculos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.vehiculos() })
    },
  })
}

/**
 * Deactivates (soft-deletes) a vehicle. Management-only.
 * Invalidates the vehiculos list on success.
 */
export function useDeactivateVehiculo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/api/v1/Logistica/vehiculos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticaKeys.vehiculos() })
    },
  })
}
