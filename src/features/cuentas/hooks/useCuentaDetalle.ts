import { useState, useMemo } from 'react'
import { useCuentaMovimientos } from '../api/queries'

export function useCuentaDetalle(id: string) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching
  } = useCuentaMovimientos(id)

  const movimientos = useMemo(() => {
    if (!data?.pages) return []
    return data.pages
      .filter(p => p !== null && p !== undefined)
      .flatMap(p => p.movimientos?.items ?? [])
  }, [data])

  const info = useMemo(() => ({
    nombre: data?.pages?.[0]?.nombre ?? 'Cuenta Corriente',
    saldoActual: data?.pages?.[0]?.saldoActual ?? 0,
    tipoSocio: data?.pages?.[0]?.tipoSocio,
    razonSocial: data?.pages?.[0]?.razonSocial,
    socioComercialId: data?.pages?.[0]?.socioComercialId ?? null,
    esActiva: data?.pages?.[0]?.activo ?? true,
  }), [data])

  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false)
  const [showFullNumber, setShowFullNumber] = useState(false)

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  return {
    state: {
      movimientos,
      info,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      isRefetching,
      isArchiveModalVisible,
      showFullNumber,
    },
    actions: {
      refetch,
      handleLoadMore,
      setIsArchiveModalVisible,
      setShowFullNumber,
    }
  }
}
