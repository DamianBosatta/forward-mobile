import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { components } from '@/libs/api-client/generated/schema'
import { cuentasKeys } from '@/features/cuentas/api/queries'
import { tesoreriaKeys } from '@/libs/api-client/tesoreria'
import type { GastoPayload } from '../lib/servicio'

export type TipoGasto = components['schemas']['TipoGastoResponse']

export const gastosKeys = { all: ['gastos'] as const }

/** Conceptos de gasto activos (`GET /gastos/tipos-gasto`: MOD_PAGOS:Read + CAP_VER_TESORERIA). */
export function useTiposGasto(enabled: boolean) {
  return useQuery({
    queryKey: [...gastosKeys.all, 'tipos'],
    enabled,
    queryFn: () => api.get<TipoGasto[]>('/api/v1/gastos/tipos-gasto'),
    staleTime: 10 * 60_000,
  })
}

/** Registra un gasto (`POST /gastos`, MOD_PAGOS:Create). Sin reintentos: repetirlo sacaría la plata dos veces. */
export function useRegistrarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GastoPayload) => api.post('/api/v1/gastos', payload),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gastosKeys.all })
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
      qc.invalidateQueries({ queryKey: tesoreriaKeys.all })
      qc.invalidateQueries({ queryKey: ['cajas'] })
    },
  })
}
