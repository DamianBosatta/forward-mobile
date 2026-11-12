import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { components } from '@/libs/api-client/generated/schema'
import type { RangoDeDias } from '@/features/cuentas/lib/periodo'
import { urlDePagos, type FiltroDePagos } from '../lib/pago'

export type RenglonDePago = components['schemas']['TesoreriaListDto']
type PaginaDePagos = components['schemas']['TesoreriaListDtoPaginatedResponse']
export type Pago = components['schemas']['PagoDto']

export const pagosKeys = {
  all: ['pagos'] as const,
  lista: (filtro: FiltroDePagos, busqueda: string, rango?: RangoDeDias) => [...pagosKeys.all, 'lista', filtro, busqueda, rango ?? null] as const,
  detalle: (id: string) => [...pagosKeys.all, 'detalle', id] as const,
}

/** Pagos y cobros de a 20, del más nuevo al más viejo (`GET /Tesoreria?fuente=pago`). Pedirla solo con `usePuedeVerPagos`. */
export function usePagos(filtro: FiltroDePagos, busqueda: string, rango: RangoDeDias | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: pagosKeys.lista(filtro, busqueda, rango),
    queryFn: ({ pageParam = 1 }) => api.get<PaginaDePagos>(urlDePagos(filtro, pageParam, busqueda, rango)),
    getNextPageParam: (ultima) => {
      const { page, totalPages } = ultima ?? {}
      return page && totalPages && page < totalPages ? page + 1 : undefined
    },
    initialPageParam: 1,
    staleTime: 15_000,
    enabled,
  })
}

/** Un pago con sus imputaciones y conciliaciones (`GET /Pagos/{id}`, MOD_PAGOS:Read). */
export function usePago(id: string, enabled: boolean) {
  return useQuery({
    queryKey: pagosKeys.detalle(id),
    queryFn: () => api.get<Pago>(`/api/v1/Pagos/${id}`),
    enabled: enabled && !!id,
    staleTime: 15_000,
  })
}
