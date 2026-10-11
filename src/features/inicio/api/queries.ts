import { useQuery } from '@tanstack/react-query'
import { api } from '@/libs/api-client/client'
import { comprasKeys } from '@/libs/api-client/compras'
import type { components } from '@/libs/api-client/generated/schema'

type ComprasResumenDto = components['schemas']['ComprasResumenDto']

// Las claves cuelgan de ventasKeys.all / comprasKeys.all: cualquier alta o cambio que
// invalide Ventas o Compras también refresca Inicio.

/** Contadores por estado de TODAS las compras: GET /api/v1/Compras/resumen sin filtros. */
export function useComprasResumenInicio(enabled: boolean) {
  return useQuery({
    queryKey: [...comprasKeys.all, 'inicio', 'resumen'] as const,
    queryFn: () => api.get<ComprasResumenDto>('/api/v1/Compras/resumen'),
    staleTime: 30_000,
    enabled,
  })
}
