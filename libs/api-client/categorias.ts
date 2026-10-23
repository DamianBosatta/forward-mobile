import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/** Categoría del árbol del catálogo: `nivel` 1 = Línea, 2 = Familia (más abajo, Categoría y Subcategoría). */
export type CategoriaItem = components['schemas']['CategoriaResponse']

export const categoriasKeys = {
  all: ['categorias'] as const,
}

/** GET /api/v1/Categorias: lista plana; el árbol se arma por `categoriaPadreId`. Cambia poco: se guarda 10 min. */
export function useCategorias() {
  return useQuery({
    queryKey: categoriasKeys.all,
    queryFn: () => api.get<CategoriaItem[]>('/api/v1/Categorias'),
    staleTime: 10 * 60_000,
  })
}
