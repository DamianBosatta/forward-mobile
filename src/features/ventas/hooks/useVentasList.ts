import { useState, useMemo } from 'react'
import { useInfiniteVentas, useVentasResumen, type EstadoVentaServidor } from '@/libs/api-client/ventas'
import { useColors } from '@/libs/theme'
import { getVentaStatusConfig } from '@/core/constants/status'
import { itemsCargados, totalDelServidor } from '@/features/listas/lib/contador'
import { contadorVentas, resumenFiltrado } from '../lib/resumenVentas'
import type { Venta } from '@/libs/api-client'

export type SelectedMonth = { year: number; month: number }
type FiltroVentas = 'Todas' | 'Pendiente' | 'Confirmada' | 'Preparando' | 'En Ruta' | 'Entregada' | 'Anulada' | 'Por Autorizar'

/** Estados del servidor de cada chip (la etiqueta es la de getVentaStatusConfig). */
const ESTADOS_DEL_FILTRO: Record<FiltroVentas, EstadoVentaServidor[]> = {
  Todas: [],
  Pendiente: ['Pendiente'],
  Confirmada: ['Confirmada'],
  Preparando: ['EnPreparacion', 'Empacada'],
  'En Ruta': ['EnRuta'],
  Entregada: ['Entregada'],
  Anulada: ['Anulada'],
  'Por Autorizar': ['PendienteAutorizacion'],
}

/**
 * Hook para gestionar la lógica de la lista de ventas con soporte para scroll infinito.
 * Delega búsqueda y filtrado al backend (SQL) para máximo rendimiento móvil.
 */
export function useVentasList() {
  const colors = useColors()
  const now = new Date()

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<FiltroVentas>('Todas')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedMonth>({ year: now.getFullYear(), month: now.getMonth() })
  const [tipoOperacion, setTipoOperacion] = useState<number>(2) // 2 = Pedido, 1 = Presupuesto

  const isCurrentMonth = selected.year === now.getFullYear() && selected.month === now.getMonth()

  const fechaDesde = new Date(selected.year, selected.month, 1).toISOString()
  const fechaHasta = new Date(selected.year, selected.month + 1, 0, 23, 59, 59).toISOString()

  // Búsqueda y estado van al servidor; el resumen se pide con los mismos filtros.
  const estados = ESTADOS_DEL_FILTRO[filter]
  const filtro = {
    tipoOperacion,
    estados: estados.length > 0 ? estados : undefined,
    fechaDesde,
    fechaHasta,
    searchTerm: searchTerm.length >= 2 ? searchTerm : undefined,
  }
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteVentas({ pageSize: 20, ...filtro })
  const resumen = useVentasResumen(filtro)

  // Aplanamos las páginas en una sola lista para el renderizado
  // Vendor scoping is enforced server-side: GetAllVentasQueryHandler adds
  // WHERE v."VendedorId" = @UserId for Vendedor role users before the query runs.
  // VentaDtoList intentionally omits vendedorId — no client-side re-filter needed.
  const rawVentas = useMemo(() => itemsCargados<Venta>(data?.pages), [data])
  const totalCount = totalDelServidor(data?.pages)

  const filteredVentas = useMemo(() => {
    let result = rawVentas

    // El servidor anterior a forward-system #873 ignora `estados`: se filtra también acá
    // (con el servidor nuevo no saca nada).
    if (filter !== 'Todas') {
      result = result.filter(v => getVentaStatusConfig(v.estado, colors).label === filter)
    }

    return result
  }, [rawVentas, filter, colors])

  // Contador e importe del resumen, nunca sumados sobre las páginas cargadas. Con el servidor
  // anterior a #873 el estado se filtra solo acá: "cargados" no es lo que se ve y el contador
  // se oculta. Ver BACKLOG-9B.md.
  const contador = filter === 'Todas' || resumenFiltrado(resumen.data)
    ? contadorVentas(filteredVentas.length, totalCount, resumen.data, { tipoOperacion, estados })
    : null

  return {
    searchTerm, setSearchTerm,
    filter, setFilter,
    pickerOpen, setPickerOpen,
    selected, setSelected,
    tipoOperacion, setTipoOperacion,
    isCurrentMonth,
    now,
    isLoading, isRefetching,
    refetch: () => { void resumen.refetch(); return refetch() },
    fetchNextPage, hasNextPage, isFetchingNextPage,
    rawVentas, filteredVentas,
    totalCount, contador
  }
}
