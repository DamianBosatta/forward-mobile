import { useState, useMemo } from 'react'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import { useColors } from '@/libs/theme'
import { VENTA_ESTADOS, getVentaStatusConfig } from '@/core/constants/status'
import type { Venta } from '@/libs/api-client'

export type SelectedMonth = { year: number; month: number }

/**
 * Hook para gestionar la lógica de la lista de ventas con soporte para scroll infinito.
 * Delega búsqueda y filtrado al backend (SQL) para máximo rendimiento móvil.
 */
export function useVentasList() {
  const colors = useColors()
  const now = new Date()

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'Todas' | 'Pendiente' | 'Confirmada' | 'Preparando' | 'En Ruta' | 'Entregada' | 'Anulada' | 'Por Autorizar'>('Todas')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedMonth>({ year: now.getFullYear(), month: now.getMonth() })
  const [tipoOperacion, setTipoOperacion] = useState<number>(2) // 2 = Pedido, 1 = Presupuesto

  const isCurrentMonth = selected.year === now.getFullYear() && selected.month === now.getMonth()

  const fechaDesde = new Date(selected.year, selected.month, 1).toISOString()
  const fechaHasta = new Date(selected.year, selected.month + 1, 0, 23, 59, 59).toISOString()

  // Delegamos searchTerm al backend para filtrar en SQL, no en RAM del celular
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteVentas({
    pageSize: 20,
    tipoOperacion,
    fechaDesde,
    fechaHasta,
    searchTerm: searchTerm.length >= 2 ? searchTerm : undefined,
  })

  // Aplanamos las páginas en una sola lista para el renderizado
  const rawVentas = useMemo(() => {
    // Vendor scoping is enforced server-side: GetAllVentasQueryHandler adds
    // WHERE v."VendedorId" = @UserId for Vendedor role users before the query runs.
    // VentaDtoList intentionally omits vendedorId — no client-side re-filter needed.
    return data?.pages.flatMap(page => {
      return ((page as any)?.data?.items ?? (page as any)?.items ?? []) as Venta[]
    }) ?? []
  }, [data])

  const filteredVentas = useMemo(() => {
    let result = rawVentas

    // Filtrado por estado (local, ya que el backend puede no soportar multi-estado)
    if (filter !== 'Todas') {
      result = result.filter(v => getVentaStatusConfig(v.estado, colors).label === filter)
    }

    return result
  }, [rawVentas, filter, colors])

  // KPIs calculados sobre la data cargada (idealmente vendrán de /ventas/stats)
  const totalMonto = rawVentas.reduce((acc, v) => acc + (v.totalAmount || 0), 0)

  const pendCount = rawVentas.filter(v =>
    [VENTA_ESTADOS.PENDIENTE, VENTA_ESTADOS.PENDIENTE_AUTORIZACION].includes(String(v.estado) as any)
  ).length

  const ordersCount = rawVentas.length

  return {
    searchTerm, setSearchTerm,
    filter, setFilter,
    pickerOpen, setPickerOpen,
    selected, setSelected,
    tipoOperacion, setTipoOperacion,
    isCurrentMonth,
    now,
    isLoading, isRefetching, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
    rawVentas, filteredVentas,
    totalMonto, pendCount, ordersCount
  }
}
