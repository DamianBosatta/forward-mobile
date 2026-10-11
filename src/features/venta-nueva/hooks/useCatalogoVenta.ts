import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

function fetchBusqueda(termino: string) {
  const params = new URLSearchParams({ SearchTerm: termino, PageSize: String(PAGE_SIZE) })
  return api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`)
}

/**
 * Catálogo de venta (`catalogo-stock`: precio, piso, venta mínima y disponibilidad). Sin término,
 * el catálogo completo (cache de 60 s), que también resuelve el carrito y las fragancias. Con término
 * (debounce de 300 ms), la búsqueda del servidor, que devuelve familias completas: si coincide una
 * fragancia viene su línea (forward-system #874).
 *
 * Sobre lo que llegue se aplica igual la búsqueda por familias del teléfono: con ese servidor no saca
 * nada (salvo lo que coincida solo por código de proveedor, que el DTO no trae); con uno viejo, que
 * ignora `SearchTerm` y devuelve todo, es la que filtra. Mientras llega, sin respuesta (sin conexión,
 * error) o si no entró en una página, se busca en el catálogo completo ya cargado.
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
  const servidor = useQuery({
    queryKey: [...productosKeys.all, 'catalogoVenta', 'busqueda', termino],
    queryFn: () => fetchBusqueda(termino),
    enabled: termino !== '',
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const { data: respuesta, isPlaceholderData: anterior } = servidor
  const productos = useMemo(() => {
    if (!termino) return query.data ?? []
    // La respuesta de este término si entró entera; si no, el catálogo completo; sin él, la de la búsqueda anterior.
    const base = (anterior || respuesta?.hasNextPage ? undefined : respuesta?.items) ?? query.data ?? respuesta?.items ?? []
    return deFamiliasQueCoinciden(base, normalizar(termino))
  }, [query.data, respuesta, anterior, termino])

  // `cargado`: hay un catálogo del servidor (aunque un refresco posterior haya fallado); `isError`: no lo hay.
  return {
    productos,
    isLoading: query.isLoading || (termino !== '' && servidor.isLoading),
    cargado: query.data !== undefined,
    isError: query.data === undefined && query.isError,
    reintentar: query.refetch,
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function coincide(p: CatalogoStockItem, termino: string): boolean {
  return [p.nombre, p.marca, p.codigoPropio, p.codigoBarra].some((v) => v != null && normalizar(v).includes(termino))
}

/** Como el servidor: la familia (la línea y sus fragancias) entera si coincide alguno de sus productos. */
function deFamiliasQueCoinciden(items: CatalogoStockItem[], termino: string): CatalogoStockItem[] {
  const familia = (p: CatalogoStockItem) => p.productoPadreId ?? p.id
  const conCoincidencia = new Set(items.filter((p) => coincide(p, termino)).map(familia))
  return items.filter((p) => conCoincidencia.has(familia(p)))
}
