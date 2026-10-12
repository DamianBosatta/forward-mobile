import { useEffect, useMemo, useState } from 'react'
import { useInfiniteProductos } from '@/libs/api-client/productos'
import { useDisponibilidadPorLotes } from '@/libs/api-client/stock'
import { useDepositoDeConsulta } from './useDepositoDeConsulta'
import { cantidadDeConsulta } from '../lib/presentacion'

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/**
 * Catálogo de consulta: busca por código o nombre EN EL SERVIDOR (GET /Productos, paginado),
 * con el término esperado ~300 ms. Mientras llega la búsqueda nueva se ven los resultados
 * anteriores. El chip de stock sale de `hayDisponible` del listado (forward-system #894: real menos reservado
 * en todos los depósitos; una línea suma sus fragancias activas). Con un servidor anterior, que no lo manda,
 * sale de POST /Stocks/disponibilidad (un booleano por producto, descontando lo reservado, en el depósito del
 * usuario o el Central, con la venta mínima del listado si la trae, o 1): las líneas no tienen stock propio, así que no llevan chip.
 */
export function useCatalogoConsulta() {
  const depositoId = useDepositoDeConsulta()
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

  // Un pedido por página: al cargar otra solo se consultan los ids nuevos. Lo que ya trae `hayDisponible`
  // no se consulta: con el servidor nuevo todos lo traen y no sale ninguna consulta por tarjeta.
  const lotes = useMemo(
    () =>
      (query.data?.pages ?? []).map((pag) =>
        (pag?.items ?? [])
          .filter((p) => !p.esPadreDeVariantes && p.hayDisponible == null)
          .map((p) => ({ productoId: p.id, cantidad: cantidadDeConsulta(p.ventaMinimaUnidades) })),
      ),
    [query.data],
  )
  const resultados = useDisponibilidadPorLotes(depositoId, lotes)
  const consultadas = useMemo(
    () => new Map(resultados.flatMap((r) => (r.data ?? []).map((d) => [d.productoId, d.disponible] as const))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultados.map((r) => r.dataUpdatedAt).join(',')],
  )
  const disponible = useMemo(() => {
    const todas = new Map(consultadas)
    for (const p of productos) if (p.hayDisponible != null) todas.set(p.id, p.hayDisponible)
    return todas
  }, [consultadas, productos])

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
