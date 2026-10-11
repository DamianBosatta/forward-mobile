import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { PagedResult, TesoreriaListDto } from './types'

export const tesoreriaKeys = {
  all: ['tesoreria'] as const,
  historial: (params: object) => [...tesoreriaKeys.all, 'historial', params] as const,
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
