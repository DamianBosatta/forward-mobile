import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response DTO for GET /api/v1/Configuracion/margen-minimo.
 * The api client unwraps ApiResponse<T>, so consumers receive this directly.
 */
// A mano (C-021): GET /Configuracion/margen-minimo no publica esquema de respuesta en openapi.json.
export interface MargenMinimoResponse {
  margenMinimoGlobal: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────────────────────

export const configuracionKeys = {
  all: ['configuracion'] as const,
  margenMinimo: () => [...configuracionKeys.all, 'margen-minimo'] as const,
  feriados: (desde: string) => [...configuracionKeys.all, 'feriados', desde] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Hook options
// ─────────────────────────────────────────────────────────────────────────────

export interface UseConfiguracionSistemaOptions {
  /**
   * When false the query is disabled and no network request is made.
   * Use this to skip the call for non-cost roles (endpoint returns 403 for them
   * after the S3a margen-minimo gating was added to ConfiguracionController).
   *
   * Default: true (always fetch).
   */
  enabled?: boolean
}

type Schemas = import('./generated/schema').components['schemas']

/** Días de la semana con entregas (Configuración); cualquier usuario autenticado lo puede leer. */
export function useDiasEntrega() {
  return useQuery({
    queryKey: [...configuracionKeys.all, 'dias-entrega'] as const,
    queryFn: () => api.get<Schemas['DiasEntregaDto']>('/api/v1/Configuracion/dias-entrega'),
    staleTime: 10 * 60_000,
  })
}

/** Feriados cargados desde `desde` (YYYY-MM-DD). */
export function useFeriados(desde: string) {
  return useQuery({
    queryKey: configuracionKeys.feriados(desde),
    queryFn: () => api.get<Schemas['FeriadoDto'][]>(`/api/v1/Configuracion/feriados?desde=${desde}`),
    staleTime: 10 * 60_000,
  })
}
