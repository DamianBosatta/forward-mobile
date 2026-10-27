import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/** Ficha del catálogo comercial (GET /api/v1/catalogo, MOD_CATALOGO): una por producto suelto y una por línea. */
export type CatalogoComercialItem = components['schemas']['CatalogoComercialItemDto']

type CatalogoPage = components['schemas']['CatalogoComercialItemDtoPaginatedResponse']

export interface CatalogoParams {
  pageSize?: number
  search?: string
  categoriaId?: string
  conOferta?: boolean
}

export const catalogoKeys = {
  all: ['catalogo'] as const,
  infinite: (params: CatalogoParams) => [...catalogoKeys.all, 'infinite', params] as const,
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
      return api.get<CatalogoPage>(`/api/v1/catalogo?${searchParams}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? (lastPage.page ?? 1) + 1 : undefined),
    staleTime: 5 * 60_000,
  })
}
