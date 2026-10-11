import { useState, useMemo, useEffect } from 'react'
import { useInfiniteCompras, useComprasResumen } from '@/libs/api-client/compras'
import { useColors } from '@/libs/theme'
import { getCompraStatusConfig } from '@/core/constants/status_compras'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'
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

  // Mes y búsqueda los resuelve el servidor (lista y resumen con el mismo filtro): filtrar en el
  // cliente sobre páginas parciales daba contadores y totales que no eran los del mes.
  const pad = (n: number) => String(n).padStart(2, '0')
  const ultimoDia = new Date(selected.year, selected.month + 1, 0).getDate()
  const fechaDesde = `${selected.year}-${pad(selected.month + 1)}-01`
  const fechaHasta = `${selected.year}-${pad(selected.month + 1)}-${pad(ultimoDia)}`
  // La búsqueda va al servidor: sin espera, cada tecla cambiaba las keys de la lista y del resumen.
  const [terminoDebounced, setTerminoDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerminoDebounced(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])
  const busqueda = terminoDebounced.length >= 2 ? terminoDebounced : undefined

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteCompras({ pageSize: 20, fechaDesde, fechaHasta, searchTerm: busqueda })

  const { data: resumen } = useComprasResumen({ fechaDesde, fechaHasta, searchTerm: busqueda })

  const comprasByMonth = useMemo(() => itemsCargados<CompraDtoList>(data?.pages), [data])
  const totalCount = totalDelServidor(data?.pages)

  const filteredCompras = useMemo(() => {
    let result = comprasByMonth
    if (filter !== 'Todas') {
      result = result.filter(c => getCompraStatusConfig(c.estado, colors).label === filter)
    }
    return result
  }, [comprasByMonth, filter, colors])

  // Del servidor o nada: sin resumen no se muestra un número que podría estar mal.
  const pendCount = resumen?.notasPedido
  // El filtro por estado es local: con un estado elegido, "cargados" no es lo que se ve.
  const contador = filter === 'Todas' ? textoContador(comprasByMonth.length, totalCount) : null

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
    pendCount, totalCount, contador
  }
}
