import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api/client'
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

export type SaldoRestante = components['schemas']['SaldoRestanteCuentaDto']

/**
 * Cuánto queda en la cuenta de origen si sale `monto` ("Te quedan $ X en la caja"), calculado por el
 * servidor (`GET /cuentas-corrientes/propias/{id}/saldo-restante`, MOD_CC:Read). No registra nada.
 * Null con un servidor anterior (404, esperado) o si la cuenta no es una propia activa. Sin
 * `conCuentasCorrientes` (MOD_CC:Read) no se pide: el servidor contestaría 403.
 */
export function useSaldoRestante(cuentaId: string | null, monto: number | null, conCuentasCorrientes: boolean) {
  return useQuery({
    queryKey: [...cuentasKeys.all, 'saldo-restante', cuentaId, monto],
    enabled: conCuentasCorrientes && !!cuentaId && monto != null && monto > 0,
    retry: false,
    queryFn: async (): Promise<SaldoRestante | null> => {
      try {
        return await api.get<SaldoRestante>(
          `/api/v1/cuentas-corrientes/propias/${cuentaId}/saldo-restante?monto=${monto}`,
          { estadosEsperados: [404] },
        )
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
  })
}
