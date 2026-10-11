import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, productosKeys, type CatalogoStockItem, type PagedResult } from '@/libs/api-client'

export const DEBOUNCE_BUSQUEDA_MS = 300
// El servidor valida PageSize entre 1 y 1000.
const PAGE_SIZE = 1000
// Tope de seguridad ante un servidor que nunca deje de decir hasNextPage.
const MAX_PAGES = 20

/**
 * Catálogo completo de venta: páginas de 1000 hasta que no haya más.
 * TODO: unificar con `fetchCatalogoStockCompleto` (libs/api-client/productos.ts, PR #28) cuando se mergee.
 */
async function fetchCatalogoCompleto(): Promise<CatalogoStockItem[]> {
  const items: CatalogoStockItem[] = []
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const params = new URLSearchParams({ PageNumber: String(pagina), PageSize: String(PAGE_SIZE) })
    const res = await api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`)
    items.push(...(res?.items ?? []))
    if (!res?.hasNextPage) break
  }
  return items
}

/**
 * Catálogo de venta: el mismo endpoint que usa hoy la venta (`catalogo-stock`), que trae
 * el precio, el piso, la venta mínima y la disponibilidad. El endpoint no tiene búsqueda en
 * el servidor, así que se carga completo una vez (cache de 60 s) y se busca acá, con
 * debounce, sin distinguir mayúsculas ni tildes, por nombre y código.
 */
export function useCatalogoVenta(busqueda: string) {
  const [termino, setTermino] = useState(busqueda.trim())

  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), DEBOUNCE_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])

  const query = useQuery({
    queryKey: [...productosKeys.all, 'catalogoVenta', 'completo'],
    queryFn: fetchCatalogoCompleto,
    staleTime: 60_000,
  })

  const productos = useMemo(() => {
    const todos = query.data ?? []
    if (!termino) return todos
    const t = normalizar(termino)
    return todos.filter((p) => coincide(p, t))
  }, [query.data, termino])

  // `cargado`: hay un catálogo del servidor (aunque un refresco posterior haya fallado); `isError`: no lo hay.
  return { productos, isLoading: query.isLoading, cargado: query.data !== undefined, isError: query.data === undefined && query.isError, reintentar: query.refetch }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function coincide(p: CatalogoStockItem, termino: string): boolean {
  return [p.nombre, p.codigoPropio, p.codigoBarra].some((v) => v != null && normalizar(v).includes(termino))
}
