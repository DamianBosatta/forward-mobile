import { useQuery } from '@tanstack/react-query'
import { api } from './client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response DTO for GET /api/v1/Configuracion/margen-minimo.
 * The api client unwraps ApiResponse<T>, so consumers receive this directly.
 */
export interface MargenMinimoResponse {
  margenMinimoGlobal: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────────────────────

export const configuracionKeys = {
  all: ['configuracion'] as const,
  margenMinimo: () => [...configuracionKeys.all, 'margen-minimo'] as const,
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

/**
 * Returns the global minimum profit margin from the backend.
 * Endpoint: GET /api/v1/Configuracion/margen-minimo
 *
 * Used by the venta form and the per-item discount modal for client-side
 * profitability floor validation. Fetched once on mount (staleTime: 5 min)
 * to avoid per-keystroke DB calls.
 *
 * Pass `{ enabled: false }` for non-cost roles to prevent a 403 error after
 * the endpoint was role-gated in S3a.
 */
export function useConfiguracionSistema(options: UseConfiguracionSistemaOptions = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: configuracionKeys.margenMinimo(),
    queryFn: () => api.get<MargenMinimoResponse>('/api/v1/Configuracion/margen-minimo'),
    staleTime: 5 * 60_000,
    // Retry once on failure — this is a cheap cached read from the backend
    retry: 1,
    enabled,
  })
}
