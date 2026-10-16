import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
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

/**
 * `tipoOperacion` llegó con forward-system #883 (enum por nombre); `clienteDireccion` (null si el cliente no
 * tiene), `totalAmount` y `totalCurrency` con forward-system #898: un servidor anterior no los manda.
 */
export type BorradorVenta = Omit<
  components['schemas']['BorradorVentaDto'],
  'tipoOperacion' | 'clienteDireccion' | 'totalAmount' | 'totalCurrency'
> & {
  tipoOperacion?: 'Pedido' | 'Presupuesto'
  clienteDireccion?: string | null
  totalAmount?: number
  totalCurrency?: string
}
/** Número, cliente por partes y `version` (xmin) llegaron con forward-system #884: un servidor anterior no los manda. */
export type VentaPendienteAutorizacion = components['schemas']['VentaPendienteAutorizacionDto'] & {
  numeroPedido?: number | null
  codigoPedido?: string | null
  direccionCliente?: string | null
  nombreFantasiaCliente?: string | null
  razonSocialCliente?: string | null
  version?: number
}
/** Estados del contrato (incluye `EnPreparacion` y `RechazadaAutorizacion`, que `EstadoVenta` de mobile no lista). */
export type EstadoVentaServidor = components['schemas']['EstadoVenta']
/**
 * GET /Ventas/resumen. `cantidad` llegó con forward-system #873, junto con los filtros de tipo y
 * estados: si no viene, el servidor es anterior, ignoró esos filtros y su `totalVendido` no es el
 * de la lista.
 */
/** `cantidad` llegó con forward-system #873 y `totalPresupuestado` con la prioridad 3 del bloque 9: un servidor anterior no los manda. */
export type VentasResumen = Omit<components['schemas']['VentasResumenDto'], 'cantidad' | 'totalPresupuestado'> & {
  cantidad?: number
  totalPresupuestado?: number
}

// #region Query Keys
export const ventasKeys = {
  all: ['ventas'] as const,
  lists: () => [...ventasKeys.all, 'list'] as const,
  list: (params: VentaParams) => [...ventasKeys.lists(), params] as const,
  infinite: (params: VentaParams) => [...ventasKeys.all, 'infinite', params] as const,
  details: () => [...ventasKeys.all, 'detail'] as const,
  detail: (id: string) => [...ventasKeys.details(), id] as const,
  borradoresMios: () => [...ventasKeys.all, 'borradores', 'mios'] as const,
  resumen: (params: VentasFiltroParams) => [...ventasKeys.all, 'resumen', params] as const,
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
  /** Varios estados (`estados`, clave repetida; manda sobre `estado`). El servidor anterior a #873 lo ignora. */
  estados?: EstadoVentaServidor[]
}

/** Filtros que comparten la lista y el resumen: se arman igual para que el resumen cuadre con la lista. */
export type VentasFiltroParams = Pick<VentaParams, 'estado' | 'estados' | 'clienteId' | 'fechaDesde' | 'fechaHasta' | 'tipoOperacion' | 'searchTerm'>

function filtroVentasQuery(params: VentasFiltroParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (params.estado) sp.set('estado', params.estado)
  for (const e of params.estados ?? []) sp.append('estados', e)
  if (params.clienteId) sp.set('clienteId', params.clienteId)
  if (params.fechaDesde) sp.set('fechaDesde', params.fechaDesde)
  if (params.fechaHasta) sp.set('fechaHasta', params.fechaHasta)
  if (params.tipoOperacion !== undefined) sp.set('tipoOperacion', String(params.tipoOperacion))
  if (params.searchTerm) sp.set('searchTerm', params.searchTerm)
  return sp
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
export function useInfiniteVentas(
  params: VentaParams = {},
  options?: {
    enabled?: boolean
    /**
     * Mientras llega la respuesta muestra (`isPlaceholderData`) las filas ya cargadas del mismo filtro
     * sin estado ("Todas"), para quien las filtra en el teléfono mientras tanto. Nunca las de otro
     * estado (filtrar solo saca filas, no agrega) ni las de otras fechas, tipo o búsqueda: si "Todas"
     * de ese filtro no está en caché, se ve la carga.
     */
    vistaPreviaSinEstado?: boolean
  },
) {
  const queryClient = useQueryClient()
  return useInfiniteQuery({
    queryKey: ventasKeys.infinite(params),
    enabled: options?.enabled,
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = filtroVentasQuery(params)
      searchParams.set('pageNumber', String(pageParam))
      searchParams.set('pageSize', String(params.pageSize ?? 20))
      return api.get<PagedResult<Venta>>(`/api/v1/Ventas?${searchParams}`)
    },
    placeholderData: options?.vistaPreviaSinEstado
      ? () => {
        // El hash de la key descarta los `undefined`: es la misma key que pide "Todas".
        const todas = ventasKeys.infinite({ ...params, estado: undefined, estados: undefined })
        // Invalidada (se grabó o anuló una venta) ya no es lo que hay: mejor la carga.
        if (queryClient.getQueryState(todas)?.isInvalidated) return undefined
        return queryClient.getQueryData<InfiniteData<PagedResult<Venta>>>(todas)
      }
      : undefined,
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
 * Totales del servidor para el mismo filtro de la lista (`cantidad`, `totalVendido` de pedidos sin
 * anuladas ni rechazadas, y contadores por estado). Mobile no suma las páginas cargadas.
 */
export function useVentasResumen(params: VentasFiltroParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ventasKeys.resumen(params),
    queryFn: () => api.get<VentasResumen>(`/api/v1/Ventas/resumen?${filtroVentasQuery(params)}`),
    staleTime: 30_000,
    enabled: options?.enabled,
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
export function useVenta(id: string, opciones: { fresco?: boolean; activo?: boolean } = {}) {
  return useQuery({
    queryKey: ventasKeys.detail(id),
    queryFn: () => api.get<VentaDetalleDto>(`/api/v1/Ventas/${id}`),
    enabled: !!id && opciones.activo !== false,
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

export type VistaPreviaLinea = components['schemas']['VistaPreviaLineaDto']
export type VistaPreviaVenta = components['schemas']['VistaPreviaVentaDto']
export type VistaPreviaLineaParams = {
  productoId: string
  cantidad: number
  descuentoPorcentaje: number
  descuentoGeneral: number
}

/**
 * Vista previa de una línea sin grabar (`POST /Ventas/vista-previa-linea`, cierre del bloque 9): precio
 * efectivo, semáforo y, con CAP_VER_COSTOS, margen. Lo calcula el servidor con las reglas del alta.
 */
export function useVistaPreviaLinea(params: VistaPreviaLineaParams, enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.all, 'vista-previa-linea', params] as const,
    queryFn: () => api.post<VistaPreviaLinea>('/api/v1/Ventas/vista-previa-linea', params),
    enabled: !!params.productoId && enabled,
    placeholderData: (anterior) => anterior,
    staleTime: 30_000,
    retry: false,
  })
}

/**
 * Vista previa de una venta sin grabar (`POST /Ventas/vista-previa`, cierre del bloque 9): con el mismo
 * cuerpo que el alta, los motivos por los que quedaría a autorizar y los rechazos del guardado.
 */
export function useVistaPreviaVenta(cuerpo: object | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.all, 'vista-previa', cuerpo] as const,
    queryFn: () => api.post<VistaPreviaVenta>('/api/v1/Ventas/vista-previa', cuerpo),
    enabled: !!cuerpo && enabled,
    placeholderData: (anterior) => anterior,
    staleTime: 30_000,
    retry: false,
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

/** GET /api/v1/Ventas/vendedores: id y "Nombre Apellido" de quienes venden. Pide Ventas:Read. */
export function useVendedores(enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.all, 'vendedores'] as const,
    queryFn: () => api.get<components['schemas']['VendedorListItemDto'][]>('/api/v1/Ventas/vendedores'),
    staleTime: 5 * 60_000,
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

/**
 * Borrador con autoguardado (el de la web): sin líneas; el vendedor sale del token. `tipoOperacion`
 * (forward-system #883) dice qué se arma: un servidor viejo lo ignora y el borrador nace Presupuesto.
 */
export const useIniciarBorradorVenta = () => useMutation({
  mutationFn: (data: { clienteId: string; depositoId: string; tipoOperacion?: 'Pedido' | 'Presupuesto' }) =>
    api.post<VentaActionResponseDto>('/api/v1/Ventas/borradores', data),
})

/**
 * ¿El servidor guarda el tipo del borrador? El POST no lo devuelve; `BorradorVentaDto.tipoOperacion`
 * existe solo desde #883, así que si el borrador viene en /mios con el campo, el servidor es el nuevo.
 * `false`: el servidor respondió y no lo trae (viejo) o el borrador no está en la lista; `null`: no se
 * pudo preguntar (se puede reintentar). En ambos casos se recorta el descuento.
 */
export async function servidorGuardaElTipo(borradorId: string): Promise<boolean | null> {
  try {
    const borradores = await api.get<BorradorVenta[]>('/api/v1/Ventas/borradores/mios')
    if (!Array.isArray(borradores)) return null
    return borradores.some((b) => b.id === borradorId && b.tipoOperacion !== undefined)
  } catch {
    return null
  }
}

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
    mutationFn: async ({ id, version, razon, fechaPendiente, descuentoAdicionalPorcentaje }: {
      id: string; version?: number; razon?: string | null; fechaPendiente?: string; descuentoAdicionalPorcentaje?: number | null
    }) =>
      api.post<boolean>(
        `/api/v1/Ventas/${id}/autorizar`,
        buildAutorizarPayload({ ventaId: id, version: version ?? (await versionParaDecidir(id, fechaPendiente)), razon, descuentoAdicionalPorcentaje }),
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

/**
 * PDF comercial de la venta para el cliente (`GET /Ventas/{id}/pdf`): PRESUPUESTO o PEDIDO, sin
 * costos. No es la Nota de Entrega, que es el documento logístico.
 */
export function getVentaPdfUrl(id: string) {
  return `${API_URL}/api/v1/Ventas/${id}/pdf`
}

export function getNotaEntregaUrl(id: string) {
  return `${API_URL}/api/v1/Logistica/${id}/nota-entrega-pdf`
}

export function getEtiquetasUrl(id: string) {
  return `${API_URL}/api/v1/Logistica/${id}/etiquetas-pdf`
}
// #endregion
