import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { useInfiniteCatalogo, type CatalogoComercialItem } from '@/libs/api-client/catalogo'
import { DIAS_DE_NOVEDADES, novedadesDesde, type ProductoDeTarjeta } from '../lib/presentacion'

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/** La ficha del catálogo comercial con la forma que dibuja la tarjeta. Una línea se reconoce por sus fragancias. */
export function aTarjeta(item: CatalogoComercialItem): ProductoDeTarjeta {
  const fragancias = item.fragancias?.length ?? 0
  return {
    id: item.productoId,
    nombre: item.nombre,
    codigoPropio: item.codigoPropio,
    precioVenta: item.precioVenta,
    imageUrl: item.imageUrl,
    esPadreDeVariantes: fragancias > 0,
    cantidadFragancias: fragancias > 0 ? fragancias : undefined,
    novedad: item.novedad,
    precioAnterior: item.precioAnterior,
    variacionPorcentaje: item.variacionPorcentaje,
  }
}

/**
 * Catálogo de consulta: busca por código o nombre EN EL SERVIDOR (GET /catalogo, paginado, MOD_CATALOGO),
 * con el término esperado ~300 ms. Mientras llega la búsqueda nueva se ven los resultados anteriores.
 * El chip de stock sale del `disponible` que ya manda cada ficha (el servidor descuenta lo reservado, en el
 * alcance de depósitos del usuario): no hay un pedido aparte a Stock, que un vendedor sin ese módulo no puede hacer.
 * Pide las novedades de los últimos 30 días: el color de cada tarjeta (nuevo, precio nuevo, sin stock) viene del servidor.
 */
export function useCatalogoConsulta() {
  const [busqueda, setBusqueda] = useState('')
  const [soloConOferta, setSoloConOferta] = useState(false)
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined)
  const termino = useDebouncedValue(busqueda.trim(), DEBOUNCE_BUSQUEDA_MS)
  // Fijo al montar: si cambiara en cada render, la clave de la consulta también.
  const [desde] = useState(() => novedadesDesde(DIAS_DE_NOVEDADES))

  const query = useInfiniteCatalogo(
    { search: termino || undefined, pageSize: TAMANO_PAGINA, conOferta: soloConOferta || undefined, categoriaId, novedadesDesde: desde },
    { mantenerAnterior: true },
  )

  const items = useMemo(() => query.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [query.data])
  const productos = useMemo(() => items.map(aTarjeta), [items])
  const disponible = useMemo(() => new Map(items.map((i) => [i.productoId, i.disponible] as const)), [items])
  const totalCount = query.data?.pages[0]?.totalCount

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
