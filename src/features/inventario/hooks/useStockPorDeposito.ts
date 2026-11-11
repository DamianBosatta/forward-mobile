import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import type { PagedResult, StockItem } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { useDepositoSesionEfectivo } from '@/features/deposito-sesion/hooks/useDepositoDeSesion'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { SIN_FILTROS, type FiltrosDeStock } from '../lib/stock-presentacion'

/** "Todos" los depósitos: no se manda `DepositoId` y el servidor responde con los que el usuario puede ver. */
export const TODOS_LOS_DEPOSITOS = 'todos'

export type StockResumen = components['schemas']['StockResumenResponse']

const DEBOUNCE_BUSQUEDA_MS = 300
const TAMANO_PAGINA = 20

/**
 * Filtros que comparten el listado y el resumen de GET /Stocks, como la web (`aFiltrosStock`): el servidor cuenta
 * con los mismos, así que los totales y los conteos de cada filtro son de lo que se está mirando.
 * "Solo ocultos" es `Activo=false`; línea es `CategoriaId` (el servidor expande el subárbol).
 */
function filtrosDeConsulta(depositoId: string, termino: string, f: FiltrosDeStock) {
  const p = new URLSearchParams()
  if (depositoId !== TODOS_LOS_DEPOSITOS) p.set('DepositoId', depositoId)
  p.set('Activo', f.soloOcultos ? 'false' : 'true')
  if (termino) p.set('SearchTerm', termino)
  if (f.linea) p.set('CategoriaId', f.linea.id)
  if (f.marca) p.set('Marca', f.marca.clave)
  for (const e of f.estados) p.append('EstadoStock', e)
  if (f.sinPeso) p.set('SinPeso', 'true')
  return p
}

/**
 * Stock por depósito, solo consulta (S16, estructura de "Inventario & Stock" de la web). Solo se pide con
 * `conCantidades` (CAP_VER_CANTIDADES_STOCK): sin la capacidad el servidor no las manda y la pantalla no las pide.
 * El depósito arranca en el de la sesión (el suyo o el Central) y se cambia entre los que el servidor lista en el
 * resumen. Con CAP_VER_TODOS_LOS_DEPOSITOS arranca en el elegido en Inicio (sin elección, el suyo; "Todos" si eligió
 * "Todos", como la web); con CAP_VER_STOCK_OTROS_DEPOSITOS (gerente
 * de depósito) arranca en el suyo y también puede ver "Todos". Sin ninguna, no hay selector: ve el suyo. Mobile solo
 * mira. Los totales y los conteos de los filtros los cuenta el servidor (GET /Stocks/resumen); no se suman acá.
 */
export function useStockPorDeposito({ conCantidades, busqueda }: { conCantidades: boolean; busqueda: string }) {
  // El de la sesión (S8): quien ve todos lo elige en Inicio ("Todos" incluido); el resto, el propio o el Central.
  const depositoDeSesion = useDepositoSesionEfectivo()
  const [elegido, setDeposito] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltrosDeStock>(SIN_FILTROS)
  const permisos = useAuthStore((s) => s.user?.permissions)
  const veTodosLosDepositos = hasCapability(permisos, 'CAP_VER_TODOS_LOS_DEPOSITOS')
  const puedeVerTodos = veTodosLosDepositos || hasCapability(permisos, 'CAP_VER_STOCK_OTROS_DEPOSITOS')
  const depositoId = elegido ?? depositoDeSesion ?? TODOS_LOS_DEPOSITOS
  const termino = useDebouncedValue(busqueda.trim(), DEBOUNCE_BUSQUEDA_MS)
  const consulta = filtrosDeConsulta(depositoId, termino, filtros).toString()

  const resumen = useQuery({
    queryKey: ['stock-consulta', 'resumen', consulta],
    queryFn: () => api.get<StockResumen>(`/api/v1/Stocks/resumen?${consulta}`),
    enabled: conCantidades,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const lista = useInfiniteQuery({
    queryKey: ['stock-consulta', 'lista', consulta],
    queryFn: ({ pageParam = 1 }) => {
      const p = new URLSearchParams(consulta)
      p.set('PageNumber', String(pageParam))
      p.set('PageSize', String(TAMANO_PAGINA))
      return api.get<PagedResult<StockItem>>(`/api/v1/Stocks?${p}`)
    },
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.hasNextPage ? ultima.page + 1 : undefined),
    enabled: conCantidades,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const filas = useMemo(() => lista.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [lista.data])

  // Los depósitos salen del resumen, que cuenta con los filtros puestos: uno que con un filtro queda en 0 no se va de
  // los chips (seguirían sin forma de volver a él). Se recuerdan los que ya llegaron, en el orden del servidor.
  const conocidos = useRef<StockResumen['depositos']>([])
  const depositos = useMemo(() => {
    const nuevos = resumen.data?.depositos ?? []
    const ids = new Set(nuevos.map((d) => d.id))
    conocidos.current = [...nuevos, ...conocidos.current.filter((d) => !ids.has(d.id))]
    return conocidos.current
  }, [resumen.data])

  return {
    depositoId,
    puedeVerTodos,
    setDeposito,
    depositos,
    resumen: resumen.data,
    resumenConError: resumen.isError,
    filtros,
    setFiltros,
    filas,
    isLoading: lista.isLoading,
    isError: lista.isError,
    error: lista.error,
    dataUpdatedAt: lista.dataUpdatedAt,
    refetch: lista.refetch,
    cargarMas: () => {
      if (lista.hasNextPage && !lista.isFetchingNextPage) lista.fetchNextPage()
    },
    isFetchingNextPage: lista.isFetchingNextPage,
  }
}
