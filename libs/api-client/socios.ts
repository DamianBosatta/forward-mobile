import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { api } from './client'
import type { PagedResult, SocioComercial, SocioDetailDto, CreateSocioRequest, UpdateSocioRequest, ClienteLightDto } from './types'
export type { ClienteLightDto }
import { cuentasKeys } from './cuentas-corrientes'

export interface SociosParams {
  tipo?:       1 | 2        // 1 = Cliente, 2 = Proveedor
  activo?:     boolean | null
  search?:     string
  /** Cartera propia: el servidor acota a los clientes del vendedor y a los "de la casa" (management ve todo). */
  agenda?:     boolean
  /** Solo los de esa localidad (el servidor ignora mayúsculas y tildes). */
  localidad?:  string
  /** Solo los clientes con deuda vencida, entre los que el usuario puede ver el saldo. */
  conDeudaVencida?: boolean
  /** Orden de la lista (default del servidor: `RazonSocial`); `Direccion` deja los sin dirección al final. */
  ordenarPor?: 'RazonSocial' | 'Direccion'
  desc?:       boolean
  pageNumber?: number
  pageSize?:   number
}

export const sociosKeys = {
  all: ['socios'] as const,
  clientes: () => [...sociosKeys.all, 'clientes'] as const,
  lists: () => [...sociosKeys.all, 'list'] as const,
  list: (params: SociosParams) => [...sociosKeys.lists(), params] as const,
  infinite: (params: SociosParams) => [...sociosKeys.all, 'infinite', params] as const,
  detail: (id: string) => [...sociosKeys.all, 'detail', id] as const,
  recientes: () => [...sociosKeys.all, 'recientes'] as const,
  localidades: () => [...sociosKeys.all, 'localidades'] as const,
}

/**
 * Las localidades de la cartera, sin repetir, para el filtro (forward-system 9C). Un servidor que
 * todavía no tiene el endpoint responde 400 (la ruta cae en `{id}` y "localidades" no es un Guid)
 * o 404: sin reintentos, el filtro de localidad no aparece.
 */
export function useLocalidades() {
  return useQuery({
    queryKey: sociosKeys.localidades(),
    queryFn: () => api.get<string[]>('/api/v1/socios-comerciales/localidades', { estadosEsperados: [400, 404] }),
    retry: false,
    staleTime: 10 * 60_000,
  })
}

export function useClientes() {
  return useSocios({ tipo: 1, activo: true, pageSize: 200 })
}

export function useClientesActivos() {
  return useQuery({
    queryKey: [...sociosKeys.clientes(), 'activos'],
    queryFn: () => api.get<ClienteLightDto[]>('/api/v1/socios-comerciales/clientes-activos'),
    staleTime: 5 * 60_000,
  })
}

/**
 * Un cliente de "recientes" tal como lo manda `GET /socios-comerciales/clientes-recientes`
 * (forward-system #915). Tipado a mano: el schema generado todavía no lo trae.
 */
export interface ClienteReciente {
  id: string
  razonSocial: string
  direccion?: string | null
  nombreFantasia?: string | null
  nombreContacto?: string | null
  displayName: string
  /** Fecha UTC de la última venta o borrador del usuario con este cliente. */
  ultimoUso: string
}

/** Máximo de recientes que se le piden al servidor (el servidor acepta de 1 a 10). */
export const LIMITE_RECIENTES = 5

/**
 * Los últimos clientes activos que el usuario usó en sus ventas y borradores, del más reciente al más
 * viejo. El 404 de un servidor que todavía no tiene el endpoint es esperado: no se registra como error.
 */
export const fetchClientesRecientes = (limite: number = LIMITE_RECIENTES) =>
  api.get<ClienteReciente[]>(`/api/v1/socios-comerciales/clientes-recientes?limite=${limite}`, { estadosEsperados: [404] })

/**
 * Recientes del servidor para el selector de cliente. Sin reintentos: si falla (404 de un servidor
 * viejo, sin red, 403), `data` queda sin definir y el selector sigue con los recientes del teléfono.
 */
export function useClientesRecientes(habilitado: boolean) {
  return useQuery({
    queryKey: sociosKeys.recientes(),
    queryFn: () => fetchClientesRecientes(),
    enabled: habilitado,
    retry: false,
    staleTime: 30_000,
  })
}

export function useProveedores() {
  return useSocios({ tipo: 2, activo: true, pageSize: 200 })
}

export function useSocios(params: SociosParams = {}) {
  const sp = new URLSearchParams()
  if (params.tipo !== undefined) sp.append('tipo', String(params.tipo))
  if (params.activo !== undefined && params.activo !== null) sp.append('activo', String(params.activo))
  if (params.search) sp.append('searchTerm', params.search)
  if (params.pageNumber) sp.append('pageNumber', String(params.pageNumber))
  if (params.pageSize) sp.append('pageSize', String(params.pageSize))

  return useQuery({
    queryKey: sociosKeys.list(params),
    queryFn:  () => api.get<PagedResult<SocioComercial>>(`/api/v1/socios-comerciales?${sp}`),
    staleTime: 5 * 60_000,
  })
}

/**
 * Hook para scroll infinito en lista de socios comerciales
 */
export function useInfiniteSocios(params: SociosParams = {}) {
  return useInfiniteQuery({
    queryKey: sociosKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const sp = new URLSearchParams()
      sp.append('pageNumber', String(pageParam))
      sp.append('pageSize', String(params.pageSize ?? 20))
      if (params.tipo !== undefined) sp.append('tipo', String(params.tipo))
      if (params.activo !== undefined && params.activo !== null) sp.append('activo', String(params.activo))
      if (params.search) sp.append('searchTerm', params.search)
      if (params.agenda) sp.append('agenda', 'true')
      if (params.localidad) sp.append('localidad', params.localidad)
      if (params.conDeudaVencida) sp.append('conDeudaVencida', 'true')
      if (params.ordenarPor) sp.append('OrdenarPor', params.ordenarPor)
      if (params.desc) sp.append('Desc', 'true')

      // `saldoTotal` (PR #882): la suma de todo el filtro, solo en la página 1; null si no se puede dar.
      return api.get<PagedResult<SocioComercial> & { saldoTotal?: number | null }>(`/api/v1/socios-comerciales?${sp}`)
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

export function useCreateSocio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSocioRequest) => api.post<string>('/api/v1/socios-comerciales', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sociosKeys.all })
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}

export function useUpdateSocio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSocioRequest) => api.put<string>(`/api/v1/socios-comerciales/${data.id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: sociosKeys.all })
      qc.invalidateQueries({ queryKey: sociosKeys.detail(vars.id) })
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}

export function useToggleSocioStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch<boolean>(`/api/v1/socios-comerciales/${id}/toggle-status`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sociosKeys.all })
    },
    onError: (err: { status?: number; message?: string }) => {
      console.error('Toggle status error:', err)
      setTimeout(() => {
        Alert.alert(
          'Error al Modificar',
          `No se pudo cambiar el estado de este socio.\n\nStatus: ${err?.status}\nError: ${err?.message || 'Revisá tu conexión a internet o los permisos.'}`
        )
      }, 400)
    }
  })
}

export const fetchSocio = (id: string) => api.get<SocioDetailDto>(`/api/v1/socios-comerciales/${id}`)

/** `fresco`: siempre pide el detalle al servidor al montar (para editar sin pisar con un caché viejo). */
export function useSocio(id: string, opciones: { fresco?: boolean } = {}) {
  return useQuery({
    queryKey: sociosKeys.detail(id),
    queryFn: () => fetchSocio(id),
    enabled: !!id,
    staleTime: opciones.fresco ? 0 : 5 * 60_000,
    refetchOnMount: opciones.fresco ? 'always' : true,
  })
}
