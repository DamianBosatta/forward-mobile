import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { coincidePalabras } from '@/core/utils/texto'
import { useCatalogoDeVentaSeGuarda, useDepositoAjenoDeVenta } from './useDepositoDeVenta'
import { api, productosKeys, type CatalogoStockItem, type PagedResult } from '@/libs/api-client'
import { SIN_DEPOSITO_DE_SESION } from '@/core/api/depositoSesion'

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
 * La clave y la `queryFn` del catálogo completo, juntas: todo observador de la clave las usa (un observador sin
 * `queryFn` pisa la del primero y el refetch falla con «No queryFn was passed»).
 */
export const catalogoCompletoQuery = (depositoId?: string, persistir = !depositoId) => ({
  queryKey: claveCatalogo(depositoId),
  queryFn: () => fetchCatalogoCompleto(depositoId),
  // Se guardan en el teléfono el propio y el del depósito de la sesión (S3): son los que sirven sin señal. El de un
  // depósito elegido para una sola venta dura la venta.
  ...(persistir ? {} : { meta: { persist: false } }),
})

/** La clave del catálogo de un depósito ajeno (cuelga de `CLAVE_CATALOGO`: invalidar el prefijo alcanza a ambos). */
export const claveCatalogo = (depositoId?: string) => (depositoId ? [...CLAVE_CATALOGO, depositoId] : CLAVE_CATALOGO)

/**
 * El catálogo completo que usa la venta ahora: el del depósito de la venta, guardado en el teléfono si es el propio o
 * el de la sesión. Todo observador del catálogo lo arma con esto: si dos observadores de la misma clave discreparan en
 * `meta`, el último pisaría al otro.
 */
export function useCatalogoCompletoDeVenta() {
  return catalogoCompletoQuery(useDepositoAjenoDeVenta(), useCatalogoDeVentaSeGuarda())
}

/**
 * Deja en el teléfono un solo catálogo de depósito ajeno: el que se guarda ahora. Los de depósitos de sesión anteriores
 * se descartan si nadie los mira (el del propio, con la clave sin depósito, no se toca), para que cambiar de depósito
 * de la sesión no vaya llenando MMKV con catálogos completos.
 */
function descartarCatalogosDeOtrosDepositos(qc: QueryClient, depositoId: string | undefined) {
  qc.removeQueries({
    queryKey: CLAVE_CATALOGO,
    predicate: (q) => q.queryKey.length > CLAVE_CATALOGO.length && q.queryKey[CLAVE_CATALOGO.length] !== depositoId && q.getObserversCount() === 0,
  })
}

/**
 * Catálogo completo de venta: páginas de 1000 hasta que no haya más.
 * TODO: unificar con `fetchCatalogoStockCompleto` (libs/api-client/productos.ts, PR #28) cuando se mergee.
 */
export async function fetchCatalogoCompleto(depositoId?: string): Promise<Catalogo> {
  const items: CatalogoStockItem[] = []
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const params = new URLSearchParams({ PageNumber: String(pagina), PageSize: String(PAGE_SIZE) })
    if (depositoId) params.set('depositoId', depositoId)
    // Sin el depósito de la sesión, como la web (venta-form.tsx, GrillaLineasVenta.tsx): el depósito de la venta va en
    // `depositoId`. La clave no cambia: este catálogo es solo de la venta y nunca se pidió con otro encabezado.
    const res = await api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`, SIN_DEPOSITO_DE_SESION)
    items.push(...(res?.items ?? []))
    if (!res?.hasNextPage) return { items, truncado: false }
  }
  return { items, truncado: true }
}

function fetchBusqueda(termino: string, depositoId?: string) {
  const params = new URLSearchParams({ SearchTerm: termino, PageSize: String(PAGE_SIZE) })
  if (depositoId) params.set('depositoId', depositoId)
  return api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${params}`, SIN_DEPOSITO_DE_SESION)
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
  const qc = useQueryClient()
  const ajeno = useDepositoAjenoDeVenta()
  const catalogo = useCatalogoCompletoDeVenta()
  const seGuarda = useCatalogoDeVentaSeGuarda()

  const query = useQuery<Catalogo | CatalogoStockItem[], Error, Catalogo>({
    ...catalogo,
    select: aCatalogo,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (seGuarda) descartarCatalogosDeOtrosDepositos(qc, ajeno)
  }, [qc, ajeno, seGuarda])
  const completo = query.data && !query.data.truncado ? query.data.items : undefined
  const alServidor = !completo && termino.length >= 2
  const servidor = useQuery({
    queryKey: [...productosKeys.all, 'catalogoVenta', 'busqueda', termino, ...(ajeno ? [ajeno] : [])],
    queryFn: () => fetchBusqueda(termino, ajeno),
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
    return deFamiliasQueCoinciden(completo ?? servidor.data?.items ?? todos, termino)
  }, [query.data, completo, servidor.data, termino])

  // `cargado`: hay un catálogo del servidor (aunque un refresco posterior haya fallado); `isError`: no lo hay.
  return {
    productos,
    // Mientras se ve la respuesta del término anterior, todavía no se sabe si hay resultados.
    isLoading: query.isLoading || (alServidor && (servidor.isLoading || servidor.isPlaceholderData)),
    cargado: query.data !== undefined,
    isError: query.data === undefined && query.isError,
    /** Por qué falló el catálogo (sólo si `isError`): la pantalla lo pasa por `mensajeDeError`. */
    error: query.error,
    reintentar: query.refetch,
  }
}

function coincide(p: CatalogoStockItem, termino: string): boolean {
  return coincidePalabras([p.nombre, p.marca, p.codigoPropio, p.codigoProveedor, p.codigoBarra], termino)
}

/** Como el servidor: la familia (la línea y sus fragancias) entera si coincide alguno de sus productos. */
function deFamiliasQueCoinciden(items: CatalogoStockItem[], termino: string): CatalogoStockItem[] {
  const familia = (p: CatalogoStockItem) => p.productoPadreId ?? p.id
  const conCoincidencia = new Set(items.filter((p) => coincide(p, termino)).map(familia))
  return items.filter((p) => conCoincidencia.has(familia(p)))
}
