import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { useInfiniteSocios } from '@/libs/api-client/socios'
import { comprasKeys } from '@/libs/api-client/compras'
import type { CompraDtoList, PagedResult, SocioListDto } from '@/libs/api-client/types'
import { useValorDiferido } from '@/features/clientes/hooks/useCartera'

/**
 * Proveedores activos, paginados y buscados EN EL SERVIDOR (nombre o CUIT): el mismo endpoint de
 * socios comerciales que usa la web, con `tipo=2`. No hay agenda: la cartera propia es de clientes.
 */
export function useProveedores(busqueda: string) {
  const texto = useValorDiferido(busqueda.trim())
  const query = useInfiniteSocios({ tipo: 2, activo: true, search: texto, pageSize: 20 })
  const pages = query.data?.pages

  const proveedores = useMemo<SocioListDto[]>(() => (pages ?? []).flatMap(p => p?.items ?? []), [pages])
  const ultima = pages?.[pages.length - 1]

  return {
    proveedores,
    totalCount: typeof ultima?.totalCount === 'number' ? ultima.totalCount : undefined,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
    cargarMas: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
    },
  }
}

/** Cuántas compras recientes muestra la ficha. */
export const COMPRAS_EN_FICHA = 5

/**
 * Las últimas compras de un proveedor (`GET /Compras?proveedorId=`, como el historial de la web).
 * Va aparte de `useCompras` de libs porque ese hook todavía no acepta el filtro por proveedor.
 */
export function useComprasDelProveedor(proveedorId: string, habilitado: boolean, cantidad: number = COMPRAS_EN_FICHA) {
  return useQuery({
    queryKey: [...comprasKeys.all, 'proveedor', proveedorId, cantidad],
    queryFn: () =>
      api.get<PagedResult<CompraDtoList>>(`/api/v1/Compras?proveedorId=${encodeURIComponent(proveedorId)}&pageNumber=1&pageSize=${cantidad}`),
    enabled: habilitado && !!proveedorId,
    staleTime: 30_000,
  })
}
