import { useState, useMemo } from 'react'
import { useInfiniteCompras } from '@/libs/api-client/compras'
import { useColors } from '@/libs/theme'
import { getCompraStatusConfig } from '@/core/constants/status_compras'
import type { CompraDtoList } from '@/libs/api-client'

export type SelectedMonth = { year: number; month: number }

/**
 * Hook de Compras Refactorizado (Senior Level)
 * Implementa scroll infinito y filtrado por periodo.
 */
export function useComprasList() {
  const colors = useColors()
  const now = new Date()

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'Todas' | 'Pendiente' | 'Confirmado' | 'Entregado'>('Todas')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedMonth>({ year: now.getFullYear(), month: now.getMonth() })

  const isCurrentMonth = selected.year === now.getFullYear() && selected.month === now.getMonth()

  // Nota: Actualmente el backend no parece filtrar compras por fecha en el listado base,
  // se recomienda añadir ?fechaDesde y ?fechaHasta al endpoint /api/v1/Compras
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteCompras({ pageSize: 20 })

  const rawCompras = useMemo(() => {
    return data?.pages.flatMap(page => {
      return ((page as any)?.data?.items ?? (page as any)?.items ?? []) as CompraDtoList[]
    }) ?? []
  }, [data])

  const comprasByMonth = useMemo(() =>
    rawCompras.filter(c => {
      const d = new Date(c.fecha ?? '')
      return d.getMonth() === selected.month && d.getFullYear() === selected.year
    }),
    [rawCompras, selected]
  )

  const filteredCompras = useMemo(() => {
    let result = comprasByMonth
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(c => (c.razonSocialProveedor || '').toLowerCase().includes(q))
    }
    if (filter !== 'Todas') {
      result = result.filter(c => getCompraStatusConfig(c.estado, colors).label === filter)
    }
    return result
  }, [comprasByMonth, searchTerm, filter, colors])

  const totalMonto = useMemo(() => comprasByMonth.reduce((acc, c) => acc + (c.totalAmount ?? 0), 0), [comprasByMonth])
  const pendCount = useMemo(() => comprasByMonth.filter(c => getCompraStatusConfig(c.estado, colors).label === 'Pendiente').length, [comprasByMonth, colors])

  return {
    searchTerm, setSearchTerm,
    filter, setFilter,
    pickerOpen, setPickerOpen,
    selected, setSelected,
    isCurrentMonth,
    now,
    isLoading, isRefetching, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
    comprasByMonth, filteredCompras,
    totalMonto, pendCount
  }
}
