import { useState, useMemo } from 'react'
import { useInfiniteSocios } from '@/libs/api-client/socios'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'

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

  const socios = useMemo(() => itemsCargados<any>(data?.pages), [data])
  const totalCount = totalDelServidor(data?.pages)
  const contador = textoContador(socios.length, totalCount)

  // La lista ya viene filtrada a clientes (tipo = 1): el total de clientes es el del servidor.
  const kpis = { todos: totalCount }

  return {
    socios,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    kpis,
    totalCount,
    contador,
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
