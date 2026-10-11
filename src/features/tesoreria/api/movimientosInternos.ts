import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { components } from '@/libs/api-client/generated/schema'
import { cuentasKeys } from '@/features/cuentas/api/queries'
import { tesoreriaKeys } from '@/libs/api-client/tesoreria'

export type TipoMovimientoInterno = components['schemas']['TipoMovimientoInternoResponse']
export type MovimientoInternoPayload = components['schemas']['RegistrarMovimientoEntreCuentasCommand']

/** Tipos activos del catálogo (Transferencia, Depósito, Retiro…), como los configuró la empresa. */
export function useTiposMovimientoInterno() {
  return useQuery({
    queryKey: ['movimientos-internos', 'tipos'],
    queryFn: () => api.get<TipoMovimientoInterno[]>('/api/v1/movimientos-internos/tipos'),
    staleTime: 10 * 60_000,
  })
}

/** Movimiento entre cuentas propias. Sin reintentos: repetirlo movería la plata dos veces. */
export function useRegistrarMovimientoInterno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MovimientoInternoPayload) => api.post<string>('/api/v1/movimientos-internos', payload),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
      qc.invalidateQueries({ queryKey: tesoreriaKeys.all })
    },
  })
}
