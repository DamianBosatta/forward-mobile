import { useQuery } from '@tanstack/react-query'
import { api } from '@/libs/api-client/client'
import { comprasKeys } from '@/libs/api-client/compras'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'

type VentaPendienteAutorizacionDto = components['schemas']['VentaPendienteAutorizacionDto']
type ComprasResumenDto = components['schemas']['ComprasResumenDto']

// Las claves cuelgan de ventasKeys.all / comprasKeys.all: cualquier alta o cambio que
// invalide Ventas o Compras también refresca Inicio.

/**
 * Bandeja de ventas frenadas por autorización: GET /api/v1/Ventas/pendientes-autorizacion.
 * Lista completa (sin paginar) de TODAS las frenadas; el servidor la devuelve vacía a quien no
 * tiene CAP_AUTORIZAR_VENTA. `enabled` evita pedirla sin la capacidad.
 */
export function usePendientesAutorizacion(enabled: boolean) {
  return useQuery({
    queryKey: [...ventasKeys.all, 'inicio', 'pendientes-autorizacion'] as const,
    queryFn: () => api.get<VentaPendienteAutorizacionDto[]>('/api/v1/Ventas/pendientes-autorizacion'),
    staleTime: 30_000,
    enabled,
  })
}

/** Contadores por estado de TODAS las compras: GET /api/v1/Compras/resumen sin filtros. */
export function useComprasResumenInicio(enabled: boolean) {
  return useQuery({
    queryKey: [...comprasKeys.all, 'inicio', 'resumen'] as const,
    queryFn: () => api.get<ComprasResumenDto>('/api/v1/Compras/resumen'),
    staleTime: 30_000,
    enabled,
  })
}
