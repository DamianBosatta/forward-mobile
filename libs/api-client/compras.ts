import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { buildAnularCompraPayload } from './anular-compra'
import type { Compra, CompraDtoList, CompraDto, PagedResult, CreateCompraRequest, EstadoCompra } from './types'
import type { components } from './generated/schema'

type ComprobanteCompraInput = components['schemas']['ComprobanteCompraInput']

/** Filtros que comparten la lista y el resumen: el servidor los interpreta igual en los dos. */
export interface ComprasFiltroParams {
  /** yyyy-MM-dd (día de negocio) */
  fechaDesde?: string
  fechaHasta?: string
  searchTerm?: string
}

export interface ComprasListParams extends ComprasFiltroParams {
  pageSize?: number
  /** Estados a traer (`Estados` del servidor); sin estados, todos. */
  estados?: EstadoCompra[]
}

/** GET /api/v1/Compras/borradores/mios — BorradorCompraDto. */
export interface BorradorCompra {
  id: string
  version: number
  proveedorId: string
  proveedorNombre: string
  depositoId: string
  fechaModificacion: string
  cantidadLineas: number
}

/** GET /api/v1/Compras/resumen — ComprasResumenDto. */
export type ComprasResumenDto = components['schemas']['ComprasResumenDto']

function filtroQuery(params: ComprasFiltroParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (params.fechaDesde) sp.set('FechaDesde', params.fechaDesde)
  if (params.fechaHasta) sp.set('FechaHasta', params.fechaHasta)
  if (params.searchTerm) sp.set('SearchTerm', params.searchTerm)
  return sp
}

export const comprasKeys = {
  all: ['compras'] as const,
  lists: () => [...comprasKeys.all, 'list'] as const,
  list: (params: { pageNumber?: number; pageSize?: number }) => [...comprasKeys.lists(), params] as const,
  infinite: (params: ComprasListParams) => [...comprasKeys.all, 'infinite', params] as const,
  resumen: (params: ComprasFiltroParams) => [...comprasKeys.all, 'resumen', params] as const,
  borradoresMios: () => [...comprasKeys.all, 'borradores', 'mios'] as const,
  details: () => [...comprasKeys.all, 'detail'] as const,
  detail: (id: string) => [...comprasKeys.details(), id] as const,
}

/**
 * Conserva los datos previos solo si cambió la búsqueda dentro del mismo rango de fechas y los
 * mismos estados; al cambiar de período o de pestaña se ve la carga, no las filas y totales de antes.
 */
function mismoRango(a: unknown, b: ComprasListParams) {
  const prev = a as ComprasListParams | undefined
  return !!prev && prev.fechaDesde === b.fechaDesde && prev.fechaHasta === b.fechaHasta
    && (prev.estados ?? []).join() === (b.estados ?? []).join()
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
export function useInfiniteCompras(params: ComprasListParams = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: comprasKeys.infinite(params),
    enabled: options.enabled ?? true,
    queryFn: ({ pageParam = 1 }) => {
      const sp = filtroQuery(params)
      for (const e of params.estados ?? []) sp.append('Estados', e)
      sp.set('PageNumber', String(pageParam))
      sp.set('PageSize', String(params.pageSize ?? 20))
      return api.get<PagedResult<CompraDtoList>>(`/api/v1/Compras?${sp}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1
      }
      return undefined
    },
    staleTime: 30_000,
    placeholderData: (prev, prevQuery) =>
      mismoRango(prevQuery?.queryKey[2], params) ? prev : undefined,
  })
}

/**
 * Totales del servidor para el mismo filtro de la lista (total comprado sin canceladas ni
 * anuladas, y contadores por estado). Mobile no suma las páginas cargadas.
 */
export function useComprasResumen(params: ComprasFiltroParams & { estados?: EstadoCompra[] } = {}) {
  return useQuery({
    queryKey: comprasKeys.resumen(params),
    queryFn: () => {
      const sp = filtroQuery(params)
      // Recortan solo el importe por moneda; los contadores siguen siendo de todos los estados.
      for (const e of params.estados ?? []) sp.append('Estados', e)
      return api.get<ComprasResumenDto>(`/api/v1/Compras/resumen?${sp}`)
    },
    staleTime: 30_000,
    placeholderData: (prev, prevQuery) =>
      mismoRango(prevQuery?.queryKey[2], params) ? prev : undefined,
  })
}

/** Borradores automáticos de compra del usuario (no aparecen en la lista ni en el resumen). */
export function useBorradoresCompraMios(enabled = true) {
  return useQuery({
    queryKey: comprasKeys.borradoresMios(),
    queryFn: () => api.get<BorradorCompra[]>('/api/v1/Compras/borradores/mios'),
    enabled,
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
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
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
    /**
     * `fechaFacturaProveedor` (yyyy-MM-dd) es obligatoria si la condición de pago es por días desde la factura.
     * `comprobante`: el del proveedor, si se carga al recibir (va en la misma transacción).
     */
    mutationFn: ({ id, fechaFacturaProveedor, comprobante }: { id: string; fechaFacturaProveedor?: string; comprobante?: ComprobanteCompraInput }) =>
      api.post<void>(`/api/v1/Compras/${id}/recibir`, {
        compraId: id, fechaFacturaProveedor: fechaFacturaProveedor ?? null, ...(comprobante ? { comprobante } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

/** Carga o corrige el comprobante del proveedor de una compra recibida (PUT /Compras/{id}/comprobante). */
export function useGuardarComprobanteCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comprobante }: { id: string; comprobante: ComprobanteCompraInput }) =>
      api.put<components['schemas']['ComprobanteRecibidoDto']>(`/api/v1/Compras/${id}/comprobante`, comprobante),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

/**
 * Anula la recepción de una compra recibida (POST /Compras/{id}/anular-recepcion): descuenta el
 * stock que ingresó y revierte la deuda. El servidor exige MOD_COMPRAS:Delete y la capacidad
 * CAP_ANULAR_RECEPCION_COMPRAS, el motivo, y la `version` leída (409 si la compra cambió).
 */
export function useAnularRecepcionCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo, version }: { id: string; motivo: string; version: number }) =>
      api.post<string>(`/api/v1/Compras/${id}/anular-recepcion`, { compraId: id, motivo, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    },
  })
}

// ── Borrador con autoguardado (Bloque 9A, PR 3.2) ──────────────────────────────

/** CompraActionResponseDto: lo que devuelven crear borrador, editar y guardar la nota. */
export type CompraActionResponse = components['schemas']['CompraActionResponseDto']

/** Cuerpo de PUT /Compras/{id} (UpdateCompraCommand). */
export interface GuardarCompraBody {
  id: string
  version: number
  proveedorId: string
  depositoId: string
  gastosOperativos: number
  descuentoPorcentaje: number
  detalles: { productoId: string; cantidad: number; costoUnitario: number; monedaCosto: string; unidadCompra: string }[]
}

/** Llamadas sueltas del borrador: el autoguardado las encadena con la versión de cada respuesta. */
export const borradorCompraApi = {
  iniciar: (proveedorId: string, depositoId: string) =>
    api.post<CompraActionResponse>('/api/v1/Compras/borradores', { proveedorId, depositoId }),
  guardar: (body: GuardarCompraBody) => api.put<CompraActionResponse>(`/api/v1/Compras/${body.id}`, body),
  guardarNota: (id: string, version: number) =>
    api.post<CompraActionResponse>(`/api/v1/Compras/${id}/guardar-nota-pedido`, { compraId: id, version }),
  confirmar: (id: string) => api.post<void>(`/api/v1/Compras/${id}/confirmar`, { compraId: id }),
  descartar: (id: string) => api.post<boolean>(`/api/v1/Compras/${id}/descartar-borrador`, {}),
}
