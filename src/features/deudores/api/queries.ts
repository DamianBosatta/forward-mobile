import { useInfiniteQuery } from '@tanstack/react-query'
import { api, API_URL } from '@/core/api/client'
import type { components } from '@/libs/api-client/generated/schema'
import { cuentasKeys } from '@/features/cuentas/api/queries'
import type { RangoDeDias } from '@/features/cuentas/lib/periodo'

export type Deudor = components['schemas']['DeudaSocioDto']
type DeudoresPagina = components['schemas']['DeudasSocioPagedResult']

export interface FiltrosDeudores {
  /** Va como `VendedorId`: solo los clientes de ese vendedor responsable (el servidor nunca amplía el alcance). */
  vendedorId?: string
  /** Va como `SearchTerm`: razón social, nombre de fantasía o CUIT. */
  busqueda?: string
}

export const deudoresKeys = {
  lista: (f: FiltrosDeudores) => [...cuentasKeys.all, 'deudas', 'clientes', f.vendedorId ?? null, f.busqueda ?? ''] as const,
}

/** `GET /deudas/clientes`, de a 20; `PageNumber` arranca en 1. */
export function urlDeudores(f: FiltrosDeudores, pagina: number): string {
  const q = [`PageNumber=${pagina}`, 'PageSize=20']
  if (f.vendedorId) q.push(`VendedorId=${encodeURIComponent(f.vendedorId)}`)
  if (f.busqueda) q.push(`SearchTerm=${encodeURIComponent(f.busqueda)}`)
  return `/api/v1/deudas/clientes?${q.join('&')}`
}

/**
 * Clientes que deben, de mayor a menor deuda (`GET /deudas/clientes`, MOD_PAGOS:Read, como la pestaña Deudas de la
 * web). El servidor acota a lo que el usuario puede ver: un vendedor ve solo sus clientes. `deudaTotal` es la suma de
 * todo el filtro, no de lo cargado; no se suma en el teléfono.
 */
export function useDeudores(f: FiltrosDeudores, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: deudoresKeys.lista(f),
    queryFn: ({ pageParam = 1 }) => api.get<DeudoresPagina>(urlDeudores(f, pageParam)),
    getNextPageParam: (ultima) => (ultima?.pagina?.hasNextPage ? (ultima.pagina.page ?? 1) + 1 : undefined),
    initialPageParam: 1,
    staleTime: 30_000,
    enabled,
  })
}

export type FormatoEstadoDeCuenta = 'Pdf' | 'Excel'

/**
 * El estado de cuenta del socio en un archivo (`GET cuentas-corrientes/socios/{id}/estado-cuenta/export`): las dos
 * cuentas por fecha, con lo que debe, lo que pagó y el saldo. Sin rango, toda la historia.
 */
export function urlEstadoDeCuenta(socioId: string, formato: FormatoEstadoDeCuenta, rango?: RangoDeDias): string {
  const q = [`formato=${formato}`]
  if (rango) q.push(`desde=${rango.desde}`, `hasta=${rango.hasta}`)
  return `${API_URL}/api/v1/cuentas-corrientes/socios/${socioId}/estado-cuenta/export?${q.join('&')}`
}
