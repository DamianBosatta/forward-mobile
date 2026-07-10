import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { 
  PagedResult, 
  TesoreriaListDto, 
  TesoreriaTipoDto, 
  RegistrarTransaccionRequest,
  AnularTransaccionRequest 
} from './types'

export const tesoreriaKeys = {
  all: ['tesoreria'] as const,
  historial: (params: object) => [...tesoreriaKeys.all, 'historial', params] as const,
  tipos: () => [...tesoreriaKeys.all, 'tipos'] as const,
}

// ── Hooks de Lectura ──────────────────────────────────────────────────────────

export const useHistorialTesoreria = (params: {
  cuentaId?: string
  tipoMovimientoId?: string
  socioId?: string
  /** "cliente" | "proveedor" | "propia" | "gasto" */
  categoria?: string
  fechaDesde?: string
  fechaHasta?: string
  searchTerm?: string
  pageNumber?: number
  pageSize?: number
}) => {
  return useQuery({
    queryKey: tesoreriaKeys.historial(params),
    queryFn: () => {
      const sp = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
      })
      const qs = sp.toString()
      // api.get<T> ya hace el unwrap de ApiResponse<T>
      return api.get<PagedResult<TesoreriaListDto>>(`/api/v1/Tesoreria${qs ? `?${qs}` : ''}`)
    },
  })
}

export const useTiposTesoreria = () => {
  return useQuery({
    queryKey: tesoreriaKeys.tipos(),
    queryFn: () => api.get<TesoreriaTipoDto[]>('/api/v1/Tesoreria/tipos'),
    staleTime: 1000 * 60 * 10, // 10 min — tipos rara vez cambian
  })
}

// ── Hooks de Escritura ────────────────────────────────────────────────────────

export const useRegistrarTransaccion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    // FormData: api.post lo detecta y no usa JSON.stringify ni Content-Type: application/json
    mutationFn: (request: FormData) => api.post<string>('/api/v1/Tesoreria', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tesoreriaKeys.all })
      queryClient.invalidateQueries({ queryKey: ['finanzas'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-corrientes'] })
    },
  })
}

export const useAnularTransaccion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: AnularTransaccionRequest) =>
      api.post<string>('/api/v1/Tesoreria/anular', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tesoreriaKeys.all })
      queryClient.invalidateQueries({ queryKey: ['finanzas'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-corrientes'] })
    },
  })
}
