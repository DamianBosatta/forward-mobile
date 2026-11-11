import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { MovimientoStockHistorialDto, PagedResult } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import type { CatalogoStockItem } from '@/libs/api-client/productos'
import { TODOS_LOS_DEPOSITOS } from './useStockPorDeposito'

type StockValorizado = components['schemas']['StockValorizadoDto']

/** Ventana de "inmovilizado" que pide el reporte (la misma de la web); acá solo importa el total a costo. */
const DIAS_INMOVILIZADO = 30
const TAMANO_PAGINA_MOVIMIENTOS = 20

/**
 * "Valor del stock a costo" del depósito que se mira (sin depósito, de todos): GET /Reportes/stock/valorizado, como
 * la web (StockResumenKpis). Solo con CAP_VER_COSTOS: sin ella el reporte responde 403, así que ni se pide.
 */
export function useValorDelStockACosto(depositoId: string, habilitado: boolean) {
  const p = new URLSearchParams({ DiasInmovilizado: String(DIAS_INMOVILIZADO) })
  if (depositoId !== TODOS_LOS_DEPOSITOS) p.set('DepositoId', depositoId)
  const consulta = p.toString()
  return useQuery({
    queryKey: ['stock-consulta', 'valor-costo', consulta],
    queryFn: () => api.get<StockValorizado>(`/api/v1/Reportes/stock/valorizado?${consulta}`),
    enabled: habilitado,
    staleTime: 60_000,
  })
}

/** Movimientos de un producto, de a 20 (web StockMovimientosPanel): GET /Stocks/movimientos. Cerrado no consulta. */
export function useMovimientosDeStock(productoId: string, habilitado: boolean) {
  return useInfiniteQuery({
    queryKey: ['stock-consulta', 'movimientos', productoId],
    queryFn: ({ pageParam = 1 }) => {
      const p = new URLSearchParams({ ProductoId: productoId, PageNumber: String(pageParam), PageSize: String(TAMANO_PAGINA_MOVIMIENTOS) })
      return api.get<PagedResult<MovimientoStockHistorialDto>>(`/api/v1/Stocks/movimientos?${p}`)
    },
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.hasNextPage ? ultima.page + 1 : undefined),
    enabled: habilitado && !!productoId,
    staleTime: 30_000,
  })
}

/**
 * Rentabilidad del detalle (web InventarioDetailSheet): bandas de precio y costo real salen del catálogo con stock.
 * La web baja el catálogo entero del depósito; acá se busca solo ese producto por su código y se toma el de su id.
 * Solo con CAP_VER_COSTOS (el servidor redacta los costos igual).
 */
export function useRentabilidadDeProducto(productoId: string, codigo: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['stock-consulta', 'rentabilidad', productoId],
    queryFn: async () => {
      const p = new URLSearchParams({ pageNumber: '1', pageSize: '10', searchTerm: codigo })
      const pagina = await api.get<PagedResult<CatalogoStockItem>>(`/api/v1/Productos/catalogo-stock?${p}`)
      return pagina.items?.find((i) => i.id === productoId) ?? null
    },
    enabled: habilitado && !!productoId && !!codigo,
    staleTime: 60_000,
  })
}
