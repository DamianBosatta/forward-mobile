import { useState, useMemo } from 'react'
import { useInfiniteSocios } from '@/libs/api-client/socios'

export type TypeFilter = 'Todos' | 'Clientes' | 'Proveedores'
export type StatusFilter = 'Todos' | 'Activos' | 'Inactivos'

/**
 * Hook de Socios Refactorizado (Senior Level)
 * Implementa scroll infinito y búsqueda delegada al back.
 */
export function useSociosList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Todos')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos')

  const tipoParam = typeFilter === 'Clientes' ? 1 : typeFilter === 'Proveedores' ? 2 : undefined
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
    tipo: tipoParam as any,
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
    proveedores: socios.filter(s => s.tipo === 'Proveedor').length,
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
      typeFilter,
      statusFilter,
    },
    actions: {
      setSearchTerm,
      setTypeFilter,
      setStatusFilter,
    }
  }
}
