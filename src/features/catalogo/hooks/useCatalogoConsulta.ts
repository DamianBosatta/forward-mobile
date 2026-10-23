import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { useInfiniteProductos } from '@/libs/api-client/productos'
import { useDisponibilidadPorLotes } from '@/libs/api-client/stock'
import { useDepositoDeConsulta } from './useDepositoDeConsulta'

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/**
 * Catálogo de consulta: busca por código o nombre EN EL SERVIDOR (GET /Productos, paginado),
 * con el término esperado ~300 ms. Mientras llega la búsqueda nueva se ven los resultados
 * anteriores. El chip de stock sale de POST /Stocks/disponibilidad (un booleano por producto,
 * descontando lo reservado, en el depósito del usuario o el Central): las líneas no tienen stock propio, así que no llevan chip.
 */
export function useCatalogoConsulta() {
  const depositoId = useDepositoDeConsulta()
  const [busqueda, setBusqueda] = useState('')
  const [soloConOferta, setSoloConOferta] = useState(false)
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined)
  const termino = useDebouncedValue(busqueda.trim(), DEBOUNCE_BUSQUEDA_MS)

  const query = useInfiniteProductos(
    { search: termino || undefined, pageSize: TAMANO_PAGINA, soloActivos: true, conOferta: soloConOferta || undefined, categoriaId },
    { mantenerAnterior: true },
  )

  const productos = useMemo(() => query.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [query.data])
  const totalCount = query.data?.pages[0]?.totalCount

  // Un pedido por página: al cargar otra solo se consultan los ids nuevos.
  const lotes = useMemo(
    () =>
      (query.data?.pages ?? []).map((pag) =>
        (pag?.items ?? [])
          .filter((p) => !p.esPadreDeVariantes)
          .map((p) => ({ productoId: p.id, cantidad: 1 })),
      ),
    [query.data],
  )
  const resultados = useDisponibilidadPorLotes(depositoId, lotes)
  const disponible = useMemo(
    () => new Map(resultados.flatMap((r) => (r.data ?? []).map((d) => [d.productoId, d.disponible] as const))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultados.map((r) => r.dataUpdatedAt).join(',')],
  )

  return {
    busqueda,
    setBusqueda,
    soloConOferta,
    setSoloConOferta,
    categoriaId,
    setCategoriaId,
    productos,
    totalCount,
    disponible,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** Cuándo llegó lo que se muestra (0 = nunca): para "sin conexión" con lo guardado. */
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
    cargarMas: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
    },
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
