import { useState, useMemo, useEffect } from 'react'
import { useInfiniteStock } from '@/libs/api-client/stock'
import { useDepositos } from '@/libs/api-client/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'

/**
 * Hook de Inventario Refactorizado (Senior Level)
 * Maneja scroll infinito, filtrado por depósito y búsqueda delegada al back.
 */
export function useInventarioList() {
  const { user } = useAuthStore()

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [depositoId, setDepositoId] = useState<string | undefined>(user?.depositoId)
  const [showDepoSelector, setShowDepoSelector] = useState(false)
  const [filterIndex, setFilterIndex] = useState(0) // 0: Activos, 1: Inactivos, 2: Todos

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Obtener lista de depósitos para el selector
  const { data: depositosData } = useDepositos()
  const depositos = depositosData ?? []
  const selectedDepo = depositos.find(d => d.id === depositoId)

  // Mapeo de filterIndex a parámetro de API
  const soloActivos = filterIndex === 0 ? true : (filterIndex === 1 ? false : undefined)

  // Query Principal con Scroll Infinito de Stock
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteStock({
    pageSize: 20,
    search: debouncedSearch,
    activo: soloActivos,
    depositoId
  })

  // Aplanamos las páginas del Infinite Query
  const productos = useMemo(() => {
    return data?.pages.flatMap((page: any) => {
      return (page?.data?.items ?? page?.items ?? [])
    }) ?? []
  }, [data])

  // KPIs (Cálculo temporal en cliente)
  const totalValue = productos.reduce((acc, p) => acc + ((p as any).precioVenta ?? 0) * (p.cantidadActual ?? 0), 0)
  const lowStockCount = productos.filter(p => p.enAlerta || (p.cantidadDisponible !== undefined && p.cantidadDisponible <= (p.stockMinimo ?? 10))).length
  const totalVirtual = productos.reduce((acc, p) => acc + (p.cantidadVirtual ?? 0), 0)

  return {
    searchTerm, setSearchTerm,
    depositoId, setDepositoId,
    showDepoSelector, setShowDepoSelector,
    filterIndex, setFilterIndex,
    depositos, selectedDepo,
    productos, // Lista real de StockItem!
    isLoading, isRefetching, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
    totalValue, lowStockCount, totalVirtual
  }
}
