import { useEffect, useMemo, useState } from 'react'
import { useInfiniteProductos } from '@/libs/api-client/productos'
import { useDisponibilidad } from '@/libs/api-client/stock'
import { useAuthStore } from '@/features/auth/store/auth.store'

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/**
 * Catálogo de consulta: busca por código o nombre EN EL SERVIDOR (GET /Productos, paginado),
 * con el término esperado ~300 ms. Mientras llega la búsqueda nueva se ven los resultados
 * anteriores. El chip de stock sale de POST /Stocks/disponibilidad (un booleano por producto
 * en el depósito del usuario): las líneas no tienen stock propio, así que no llevan chip.
 */
export function useCatalogoConsulta() {
  const depositoId = useAuthStore((s) => s.user?.depositoId)
  const [busqueda, setBusqueda] = useState('')
  const [termino, setTermino] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), DEBOUNCE_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])

  const query = useInfiniteProductos(
    { search: termino || undefined, pageSize: TAMANO_PAGINA, soloActivos: true },
    { mantenerAnterior: true },
  )

  const productos = useMemo(() => query.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [query.data])
  const totalCount = query.data?.pages[0]?.totalCount

  const idsConStock = useMemo(
    () => productos.filter((p) => !p.esPadreDeVariantes).map((p) => p.id),
    [productos],
  )
  const { data: disponibilidad } = useDisponibilidad(depositoId, idsConStock)
  const disponible = useMemo(
    () => new Map((disponibilidad ?? []).map((d) => [d.productoId, d.disponible])),
    [disponibilidad],
  )

  return {
    busqueda,
    setBusqueda,
    productos,
    totalCount,
    disponible,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    cargarMas: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
    },
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
