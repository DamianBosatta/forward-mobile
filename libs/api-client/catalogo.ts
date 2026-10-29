import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/** Ficha del catálogo comercial (GET /api/v1/catalogo, MOD_CATALOGO): una por producto suelto y una por línea. */
export type CatalogoComercialItem = components['schemas']['CatalogoComercialItemDto']

/** Product sheet for catalog-only users (GET /api/v1/catalogo/{id}): no cost, floor or quantities. */
export type FichaCatalogo = components['schemas']['FichaCatalogoDto']

type CatalogoPage = components['schemas']['CatalogoComercialItemDtoPaginatedResponse']

export interface CatalogoParams {
  pageSize?: number
  search?: string
  categoriaId?: string
  conOferta?: boolean
  /** YYYY-MM-DD (día argentino): con esto cada ficha trae su marca de novedad, precio anterior y variación. */
  novedadesDesde?: string
}

export const catalogoKeys = {
  all: ['catalogo'] as const,
  infinite: (params: CatalogoParams) => [...catalogoKeys.all, 'infinite', params] as const,
  ficha: (productoId: string, depositoId: string) => [...catalogoKeys.all, 'ficha', productoId, depositoId] as const,
}

/**
 * Catálogo de consulta paginado. Lo habilita MOD_CATALOGO (no Stock). `disponible` ya viene resuelto por el servidor.
 * `mantenerAnterior`: mientras llega la búsqueda nueva se ven los resultados anteriores.
 */
export function useInfiniteCatalogo(params: CatalogoParams = {}, { mantenerAnterior = false } = {}) {
  return useInfiniteQuery({
    placeholderData: mantenerAnterior ? keepPreviousData : undefined,
    queryKey: catalogoKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('PageNumber', String(pageParam))
      searchParams.set('PageSize', String(params.pageSize ?? 20))
      if (params.search) searchParams.set('SearchTerm', params.search)
      if (params.categoriaId) searchParams.set('CategoriaId', params.categoriaId)
      if (params.conOferta) searchParams.set('ConOferta', 'true')
      if (params.novedadesDesde) searchParams.set('NovedadesDesde', params.novedadesDesde)
      return api.get<CatalogoPage>(`/api/v1/catalogo?${searchParams}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? (lastPage.page ?? 1) + 1 : undefined),
    staleTime: 5 * 60_000,
  })
}

/**
 * Product sheet (MOD_CATALOGO, not Stock): availability comes resolved by the server in `depositoId`, also per active
 * fragrance and for a minimum sale. 404 when the user's catalog does not list the product.
 */
export function useFichaCatalogo(productoId: string, depositoId: string) {
  return useQuery({
    queryKey: catalogoKeys.ficha(productoId, depositoId),
    queryFn: () => api.get<FichaCatalogo>(`/api/v1/catalogo/${productoId}?depositoId=${depositoId}`),
    enabled: !!productoId,
    staleTime: 60_000,
  })
}
