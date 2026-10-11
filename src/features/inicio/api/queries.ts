import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/libs/api-client/client'
import { comprasKeys } from '@/libs/api-client/compras'
import { inicioKeys } from '@/core/query/queryClient'
import type { components } from '@/libs/api-client/generated/schema'

type Schemas = components['schemas']
type ComprasResumenDto = Schemas['ComprasResumenDto']
export type PendienteInicio = Schemas['InicioPendienteDto']
export type ImporteInicio = Schemas['InicioImporteDto']

/**
 * InicioResumenDto con cada sección que el usuario no puede ver en `null`: el servidor la manda
 * `null` aunque el tipo generado la marque opcional. Una fila en 0 sí llega (0 = nada pendiente).
 */
export interface ResumenInicio {
  ventas: Schemas['InicioVentasDto'] | null
  compras: Schemas['InicioComprasDto'] | null
  autorizacionesPendientes: PendienteInicio | null
}

/**
 * GET /api/v1/Inicio/resumen (forward-system #876): los pendientes de Inicio con importes por
 * moneda, en una sola llamada. Resume Ventas y Compras, así que cuelga de `inicioKeys`, que el
 * QueryClient invalida después de cualquier mutación (`crearQueryClient`).
 * `data === null`: el servidor todavía no tiene el endpoint (404, esperado: no se registra como
 * error ni se guarda en el teléfono) e Inicio vuelve a las cuatro llamadas de antes. Un 403 (usuario
 * desactivado) queda como error y no se reintenta: no va a cambiar.
 */
export function useResumenInicio(enabled: boolean) {
  return useQuery({
    queryKey: inicioKeys.resumen(),
    queryFn: async (): Promise<ResumenInicio | null> => {
      try {
        const r = await api.get<Schemas['InicioResumenDto']>('/api/v1/Inicio/resumen', { estadosEsperados: [404] })
        return { ventas: r?.ventas ?? null, compras: r?.compras ?? null, autorizacionesPendientes: r?.autorizacionesPendientes ?? null }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    staleTime: 30_000,
    retry: (fallas, e) => fallas < 1 && !(e instanceof ApiError && e.status === 403),
    enabled,
  })
}

/** Servidor sin /Inicio/resumen: contadores por estado de TODAS las compras (GET /Compras/resumen sin filtros). */
export function useComprasResumenInicio(enabled: boolean) {
  return useQuery({
    queryKey: [...comprasKeys.all, 'inicio', 'resumen'] as const,
    queryFn: () => api.get<ComprasResumenDto>('/api/v1/Compras/resumen'),
    staleTime: 30_000,
    enabled,
  })
}
