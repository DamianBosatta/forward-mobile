import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { conClave, crearIntento } from '@/core/utils/idempotencia'
import type { components } from '@/libs/api-client/generated/schema'
import type { GastoPayload } from '../lib/servicio'
import { invalidarPorCambioDeGasto } from '@/libs/api-client/invalidaciones'

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

/** Una clave por intento: el reintento o el doble toque del mismo gasto manda la misma (ver `crearIntento`). */
const intentoGasto = crearIntento()

/** Registra un gasto (`POST /gastos`, MOD_PAGOS:Create). Sin reintentos: repetirlo sacaría la plata dos veces. */
export function useRegistrarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GastoPayload) => conClave(intentoGasto, payload, (cuerpo) => api.post('/api/v1/gastos', cuerpo)),
    retry: false,
    onSuccess: () => invalidarPorCambioDeGasto(qc),
  })
}
