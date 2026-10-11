import { useState, useMemo } from 'react'
import { useInfiniteSocios } from '@/libs/api-client/socios'

export type StatusFilter = 'Todos' | 'Activos' | 'Inactivos'

/**
 * Hook de Socios Refactorizado (Senior Level)
 * Implementa scroll infinito y búsqueda delegada al back.
 */
export function useSociosList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos')

  // Mobile (Bloque 9A) gestiona SOLO clientes; la separación completa de proveedores es la fase 1 (PR 1.3).
  const TIPO_CLIENTE = 1
  const activoParam = statusFilter === 'Activos' ? true : statusFilter === 'Inactivos' ? false : undefined

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteSocios({
    pageSize: 20,
    tipo: TIPO_CLIENTE as any,
    activo: activoParam,
    search: searchTerm,
  })

  // Aplanamos los resultados paginados
  const socios = useMemo(() => {
    return data?.pages.flatMap(page => {
       return ((page as any)?.data?.items ?? (page as any)?.items ?? [])
    }) ?? []
  }, [data])
  
  // KPIs basados en la carga actual (mientras no haya endpoint de /stats)
  const kpis = useMemo(() => ({
    todos: socios.length,
    clientes: socios.filter(s => s.tipo === 'Cliente').length,
  }), [socios])

  return {
    socios,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    kpis,
    filters: {
      searchTerm,
      statusFilter,
    },
    actions: {
      setSearchTerm,
      setStatusFilter,
    }
  }
}
