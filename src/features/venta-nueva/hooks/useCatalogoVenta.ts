import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { api, productosKeys, type CatalogoStockItem, type PagedResult } from '@/libs/api-client'

export const DEBOUNCE_BUSQUEDA_MS = 300
// El servidor valida PageSize entre 1 y 1000.
const PAGE_SIZE = 1000
// Tope de seguridad ante un servidor que nunca deje de decir hasNextPage.
const MAX_PAGES = 20

/** El catálogo completo, y si quedó cortado en el tope de páginas. */
interface Catalogo {
  items: CatalogoStockItem[]
  truncado: boolean
}

// Antes se persistía como arreglo con la misma clave: se acepta, para tener catálogo sin red tras
// actualizar. `useToggleProductoStatus` y `useAjustarStock` (reescriben cachés) no se usan en mobile.
const aCatalogo = (d: Catalogo | CatalogoStockItem[]): Catalogo => (Array.isArray(d) ? { items: d, truncado: false } : d)

/** La clave del catálogo completo de la venta: la usa también el stock en vivo para refrescarlo. */
export const CLAVE_CATALOGO = [...productosKeys.all, 'catalogoVenta', 'completo'] as const

/**
 * Catálogo completo de venta: páginas de 1000 hasta que no haya más.
 * TODO: unificar con `fetchCatalogoStockCompleto` (libs/api-client/productos.ts, PR #28) cuando se mergee.
 */
export async function fetchCatalogoCompleto(): Promise<Catalogo> {
  const items: CatalogoStockItem[] = []
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const params = new URLSearchParams({ PageNumber: String(pagina), PageSize: String(PAGE_SIZE) })
    const res = await api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`)
    items.push(...(res?.items ?? []))
    if (!res?.hasNextPage) return { items, truncado: false }
  }
  return { items, truncado: true }
}

function fetchBusqueda(termino: string) {
  const params = new URLSearchParams({ SearchTerm: termino, PageSize: String(PAGE_SIZE) })
  return api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`)
}

/**
 * Catálogo de venta (`catalogo-stock`: precio, piso, venta mínima y disponibilidad). Se carga completo
 * (cache de 60 s), también para resolver el carrito y las fragancias, y se busca en el teléfono con
 * debounce de 300 ms, como el servidor: nombre y marca sin mayúsculas ni tildes, códigos propio, de
 * proveedor y de barras, y familias completas (si coincide una fragancia, va su línea).
 *
 * Solo si el catálogo completo no está (cargando, con error o truncado) y el término tiene 2
 * caracteres o más, se pide `SearchTerm` al servidor (forward-system #874). Sobre su respuesta se
 * aplica la misma búsqueda: con ese servidor no saca nada; con uno viejo, que ignora `SearchTerm` y
 * devuelve todo, es la que filtra.
 */
export function useCatalogoVenta(busqueda: string) {
  const termino = useDebouncedValue(busqueda.trim(), DEBOUNCE_BUSQUEDA_MS)

  const query = useQuery<Catalogo | CatalogoStockItem[], Error, Catalogo>({
    queryKey: CLAVE_CATALOGO,
    queryFn: fetchCatalogoCompleto,
    select: aCatalogo,
    staleTime: 60_000,
  })
  const completo = query.data && !query.data.truncado ? query.data.items : undefined
  const alServidor = !completo && termino.length >= 2
  const servidor = useQuery({
    queryKey: [...productosKeys.all, 'catalogoVenta', 'busqueda', termino],
    queryFn: () => fetchBusqueda(termino),
    enabled: alServidor,
    placeholderData: alServidor ? keepPreviousData : undefined,
    staleTime: 60_000,
    // Una entrada por término: dura poco y no se guarda en el teléfono.
    gcTime: 5 * 60_000,
    meta: { persist: false },
  })

  const productos = useMemo(() => {
    const todos = query.data?.items ?? []
    if (!termino) return todos
    // El catálogo completo manda; sin él, la respuesta del servidor; sin ella, lo que haya del catálogo.
    return deFamiliasQueCoinciden(completo ?? servidor.data?.items ?? todos, normalizar(termino))
  }, [query.data, completo, servidor.data, termino])

  // `cargado`: hay un catálogo del servidor (aunque un refresco posterior haya fallado); `isError`: no lo hay.
  return {
    productos,
    // Mientras se ve la respuesta del término anterior, todavía no se sabe si hay resultados.
    isLoading: query.isLoading || (alServidor && (servidor.isLoading || servidor.isPlaceholderData)),
    cargado: query.data !== undefined,
    isError: query.data === undefined && query.isError,
    reintentar: query.refetch,
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function coincide(p: CatalogoStockItem, termino: string): boolean {
  return [p.nombre, p.marca, p.codigoPropio, p.codigoProveedor, p.codigoBarra].some((v) => v != null && normalizar(v).includes(termino))
}

/** Como el servidor: la familia (la línea y sus fragancias) entera si coincide alguno de sus productos. */
function deFamiliasQueCoinciden(items: CatalogoStockItem[], termino: string): CatalogoStockItem[] {
  const familia = (p: CatalogoStockItem) => p.productoPadreId ?? p.id
  const conCoincidencia = new Set(items.filter((p) => coincide(p, termino)).map(familia))
  return items.filter((p) => conCoincidencia.has(familia(p)))
}
