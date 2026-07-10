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

      return api.get<PagedResult<SocioComercial>>(`/api/v1/socios-comerciales?${sp}`)
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
    onError: (err: any) => {
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

export function useSocio(id: string) {
  return useQuery({
    queryKey: sociosKeys.detail(id),
    queryFn: () => api.get<SocioDetailDto>(`/api/v1/socios-comerciales/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}
