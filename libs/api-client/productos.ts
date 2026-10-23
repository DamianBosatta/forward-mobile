import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api, API_URL } from './client'
import type { Producto, ProductoDetailDto, PagedResult, CreateProductoRequest, UpdateProductoRequest } from './types'
import type { components } from './generated/schema'

export const productosKeys = {
  all: ['productos'] as const,
  lists: () => [...productosKeys.all, 'list'] as const,
  list: (params: ProductoParams) => [...productosKeys.lists(), params] as const,
  infinite: (params: ProductoParams) => [...productosKeys.all, 'infinite', params] as const,
  detail: (id: string) => [...productosKeys.all, 'detail', id] as const,
}

export interface ProductoParams {
  pageNumber?: number
  pageSize?: number
  search?: string
  soloActivos?: boolean
  /** Buscador de la compra: comunes y fragancias (variantes), sin las líneas. Un servidor anterior lo ignora. */
  soloComprables?: boolean
}

// CatalogoStockItem derived from generated OpenAPI schema — do not hand-edit.
export type CatalogoStockItem = components['schemas']['CatalogoStockRealDto']

// ADR-4: per-warehouse stock breakdown inside CatalogoStockItem.almacenes[].
// Additive — existing consumers of CatalogoStockItem are unaffected.
export type AlmacenStockItem = components['schemas']['AlmacenStockDto']

type CatalogoStockPage = components['schemas']['CatalogoStockRealDtoPaginatedResponse']

// El servidor valida PageSize entre 1 y 1000 (PaginationValidationExtensions.MaxPageSize).
const CATALOGO_STOCK_PAGE_SIZE = 1000
// Tope de seguridad: ante un servidor que nunca deje de decir hasNextPage, no se itera sin fin.
const CATALOGO_STOCK_MAX_PAGES = 20

/**
 * El endpoint devuelve PaginatedResponse<CatalogoStockRealDto> (no un arreglo). Los consumidores
 * (buscador local de la venta, inventario) necesitan el catálogo completo, así que se piden
 * páginas de 1000 y se recorre hasNextPage. Costo: una request por cada 1000 productos
 * (hasta 20 páginas = 20 000 productos).
 */
export async function fetchCatalogoStockCompleto(depositoId?: string): Promise<CatalogoStockItem[]> {
  const items: CatalogoStockItem[] = []
  for (let pageNumber = 1; pageNumber <= CATALOGO_STOCK_MAX_PAGES; pageNumber++) {
    const searchParams = new URLSearchParams()
    if (depositoId) searchParams.set('depositoId', depositoId)
    searchParams.set('pageNumber', String(pageNumber))
    searchParams.set('pageSize', String(CATALOGO_STOCK_PAGE_SIZE))
    const page = await api.get<CatalogoStockPage>(`/api/v1/Productos/catalogo-stock?${searchParams}`)
    items.push(...(page?.items ?? []))
    if (!page?.hasNextPage) break
  }
  return items
}

/**
 * Producto por código de barras exacto, para el escáner (fragancias incluidas). El servidor
 * (forward-system #874) devuelve la familia del código y el escaneado es el que lo tiene. Uno viejo
 * ignora `CodigoBarra` y devuelve el catálogo: se siguen las páginas hasta encontrarlo, salvo que
 * `signal` diga que ya no hace falta (otro escaneo, o se cerró la pantalla).
 */
export async function buscarPorCodigoBarra(codigo: string, signal?: AbortSignal): Promise<CatalogoStockItem | null> {
  for (let pageNumber = 1; pageNumber <= CATALOGO_STOCK_MAX_PAGES && !signal?.aborted; pageNumber++) {
    const searchParams = new URLSearchParams({ CodigoBarra: codigo, PageNumber: String(pageNumber), PageSize: String(CATALOGO_STOCK_PAGE_SIZE) })
    const page = await api.get<CatalogoStockPage>(`/api/v1/Productos/catalogo-stock?${searchParams}`)
    const leido = page?.items?.find((p) => p.codigoBarra === codigo)
    if (leido || !page?.hasNextPage) return leido ?? null
  }
  return null
}

export function useCatalogoStock(depositoId?: string) {
  return useQuery({
    queryKey: [...productosKeys.all, 'catalogoStock', depositoId],
    queryFn: () => fetchCatalogoStockCompleto(depositoId),
    staleTime: 60_000,
  })
}

export function useProductos(params: ProductoParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.pageNumber) searchParams.set('pageNumber', String(params.pageNumber))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.search) searchParams.set('searchTerm', params.search)
  if (params.soloActivos !== undefined) searchParams.set('soloActivos', String(params.soloActivos))
  if (params.soloComprables) searchParams.set('soloComprables', 'true')

  return useQuery({
    queryKey: productosKeys.list(params),
    queryFn: () => api.get<PagedResult<Producto>>(`/api/v1/Productos?${searchParams}`),
    staleTime: 5 * 60_000,
  })
}

/**
 * Hook para scroll infinito en lista de productos.
 * `mantenerAnterior`: mientras llega la búsqueda nueva se siguen viendo los resultados de la
 * anterior (para listas cuya única clave cambiante es el término de búsqueda).
 */
export function useInfiniteProductos(params: ProductoParams = {}, { mantenerAnterior = false } = {}) {
  return useInfiniteQuery({
    placeholderData: mantenerAnterior ? keepPreviousData : undefined,
    queryKey: productosKeys.infinite(params),
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('pageNumber', String(pageParam))
      searchParams.set('pageSize', String(params.pageSize ?? 20))
      if (params.search) searchParams.set('searchTerm', params.search)
      if (params.soloActivos !== undefined) searchParams.set('soloActivos', String(params.soloActivos))
      if (params.soloComprables) searchParams.set('soloComprables', 'true')

      return api.get<PagedResult<Producto>>(`/api/v1/Productos?${searchParams}`)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1
      }
      return undefined
    },
    staleTime: 5 * 60_000,
  })
}

export function useProducto(id: string) {
  return useQuery({
    queryKey: productosKeys.detail(id),
    queryFn: () => api.get<ProductoDetailDto>(`/api/v1/Productos/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

export type VarianteProducto = components['schemas']['VarianteListItemDto']

/**
 * Fragancias (variantes) de una línea. El servidor redacta las cantidades a quien no puede verlas.
 * Con `depositoId`, la disponibilidad (`stockDisponible`, `puedeVenderse`) es la de ese depósito.
 */
export function useVariantesProducto(id: string, enabled = true, depositoId?: string) {
  return useQuery({
    queryKey: [...productosKeys.detail(id), 'variantes', depositoId ?? null] as const,
    queryFn: () => api.get<VarianteProducto[]>(`/api/v1/Productos/${id}/variantes${depositoId ? `?depositoId=${depositoId}` : ''}`),
    enabled: !!id && enabled,
    staleTime: 60_000,
  })
}

export function useCreateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProductoRequest) => api.post<Producto>('/api/v1/Productos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productosKeys.all }),
  })
}

export function useUpdateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProductoRequest) => api.put<Producto>(`/api/v1/Productos/${data.id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productosKeys.all })
      queryClient.invalidateQueries({ queryKey: productosKeys.detail(variables.id) })
    },
  })
}

/** Forma mínima de un producto dentro de cualquier caché de productos. */
interface ProductoEnCache {
  id?: string
  activo?: boolean
}

/** Las cachés de productos guardan listas, páginas infinitas, envoltorios {data} o el detalle suelto. */
type CacheProductos =
  | ProductoEnCache[]
  | {
      id?: string
      activo?: boolean
      data?: { items?: ProductoEnCache[] }
      items?: ProductoEnCache[]
      pages?: { data?: { items?: ProductoEnCache[] }; items?: ProductoEnCache[] }[]
    }

/**
 * Update Optimista para Toggle Status de Producto
 */
export function useToggleProductoStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => 
      api.put<boolean>(`/api/v1/Productos/${id}/toggle-status`, { activo }),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: productosKeys.all })
      const previousData = queryClient.getQueryData(productosKeys.all)

      const aplicar = (p: ProductoEnCache) =>
        p.id === variables.id ? { ...p, activo: variables.activo } : p

      queryClient.setQueriesData<CacheProductos>({ queryKey: productosKeys.all }, (old) => {
        if (!old) return old
        if (Array.isArray(old)) return old.map(aplicar)

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: { ...page.data, items: page.data?.items?.map(aplicar) },
              items: page.items?.map(aplicar),
            })),
          }
        }

        if (old.data?.items) {
          return { ...old, data: { ...old.data, items: old.data.items.map(aplicar) } }
        }

        if (old.id === variables.id) return { ...old, activo: variables.activo }

        return old
      })

      return { previousData }
    },

    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(productosKeys.all, context.previousData)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productosKeys.all })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export interface CatalogoPdfFiltros {
  search?: string
  soloDisponibles?: boolean
  conOferta?: boolean
}

/** URL del PDF del catálogo con los mismos filtros que la pantalla (GET /Productos/catalogo-pdf). */
export function getCatalogoPdfUrl({ search, soloDisponibles, conOferta }: CatalogoPdfFiltros): string {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('SearchTerm', search.trim())
  if (soloDisponibles) params.set('SoloDisponibles', 'true')
  if (conOferta) params.set('ConOferta', 'true')
  const query = params.toString()
  return `${API_URL}/api/v1/Productos/catalogo-pdf${query ? `?${query}` : ''}`
}
