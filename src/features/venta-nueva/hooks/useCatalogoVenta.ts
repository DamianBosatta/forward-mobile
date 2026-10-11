import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api, productosKeys, type CatalogoStockItem, type PagedResult } from '@/libs/api-client'

export const DEBOUNCE_BUSQUEDA_MS = 300
const PAGE_SIZE = 30

/**
 * Catálogo de venta: el mismo endpoint que usa hoy la venta (`catalogo-stock`), que trae
 * el precio, el piso, la venta mínima y la disponibilidad. Paginado en el servidor y
 * con la búsqueda pedida al servidor con debounce.
 *
 * BACKLOG-9B: `catalogo-stock` todavía no acepta `SearchTerm`. Mientras tanto se manda
 * igual (el servidor lo ignora) y lo cargado se filtra acá para que la búsqueda responda.
 */
export function useCatalogoVenta(busqueda: string) {
  const [termino, setTermino] = useState(busqueda.trim())

  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), DEBOUNCE_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])

  const query = useInfiniteQuery({
    queryKey: [...productosKeys.all, 'catalogoVenta', termino],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ PageNumber: String(pageParam), PageSize: String(PAGE_SIZE) })
      if (termino) params.set('SearchTerm', termino)
      return api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`)
    },
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.hasNextPage ? ultima.page + 1 : undefined),
    staleTime: 60_000,
  })

  const productos = useMemo(() => {
    const todos = query.data?.pages.flatMap((p) => p.items ?? []) ?? []
    return termino ? todos.filter((p) => coincide(p, termino)) : todos
  }, [query.data, termino])

  return {
    productos,
    totalCount: query.data?.pages[0]?.totalCount ?? 0,
    isLoading: query.isLoading,
    hayMas: query.hasNextPage,
    cargarMas: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
  }
}

function coincide(p: CatalogoStockItem, termino: string): boolean {
  const t = termino.toLowerCase()
  return [p.nombre, p.codigoPropio, p.codigoBarra, p.marca].some((v) => v?.toLowerCase().includes(t))
}
