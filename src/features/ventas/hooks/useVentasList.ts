import { useState, useMemo } from 'react'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import { useColors } from '@/libs/theme'
import { getVentaStatusConfig } from '@/core/constants/status'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'
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
  // Vendor scoping is enforced server-side: GetAllVentasQueryHandler adds
  // WHERE v."VendedorId" = @UserId for Vendedor role users before the query runs.
  // VentaDtoList intentionally omits vendedorId — no client-side re-filter needed.
  const rawVentas = useMemo(() => itemsCargados<Venta>(data?.pages), [data])
  const totalCount = totalDelServidor(data?.pages)

  const filteredVentas = useMemo(() => {
    let result = rawVentas

    // Filtrado por estado (local, ya que el backend puede no soportar multi-estado)
    if (filter !== 'Todas') {
      result = result.filter(v => getVentaStatusConfig(v.estado, colors).label === filter)
    }

    return result
  }, [rawVentas, filter, colors])

  // El total de órdenes es el del servidor. El importe total y los pendientes NO se muestran:
  // GET /Ventas/resumen no filtra por tipoOperacion (mezcla pedidos y presupuestos guardados) y
  // sumar las páginas cargadas da un número parcial. Ver BACKLOG-9B.md.
  // El filtro por estado es local: con un estado elegido, "cargados" no es lo que se ve.
  const contador = filter === 'Todas' ? textoContador(rawVentas.length, totalCount) : null

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
    totalCount, contador
  }
}
