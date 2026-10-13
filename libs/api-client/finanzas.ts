import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CajaActivaDto, MovimientoCajaDto, Pago, PagedResult } from './types'
import type { components } from './generated/schema'

type CerrarCajaResponseDto = components['schemas']['CerrarCajaResponseDto']

export const finanzasKeys = {
  cajaActiva: ['caja', 'activa'] as const,
  cajas: ['cajas'] as const,
  movimientosCaja: (cajaId: string) => ['caja', cajaId, 'movimientos'] as const,
}

// ── Caja ─────────────────────────────────────────────────────────────────────

export function useCajaActiva() {
  return useQuery({
    queryKey: finanzasKeys.cajaActiva,
    queryFn: () => api.get<CajaActivaDto | null>('/api/v1/Cajas/activa'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useMovimientosCaja(cajaId: string) {
  return useQuery({
    queryKey: finanzasKeys.movimientosCaja(cajaId),
    queryFn: () => api.get<MovimientoCajaDto[]>(`/api/v1/Cajas/${cajaId}/movimientos`),
    enabled: !!cajaId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useAbrirCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saldoInicial: number) =>
      api.post<string>('/api/v1/Cajas/abrir', { saldoInicial }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: finanzasKeys.cajaActiva }),
  })
}

export function useCerrarCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cajaId, saldoFinalDeclarado }: { cajaId: string; saldoFinalDeclarado: number }) =>
      api.post<CerrarCajaResponseDto>('/api/v1/Cajas/cerrar', { cajaId, saldoFinalDeclarado }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: finanzasKeys.cajaActiva }),
  })
}


// ── Pagos & Cuentas Corrientes ──────────────────────────────────────────────

export function usePagos(params: { pageNumber?: number; pageSize?: number; socioId?: string } = {}) {
  const searchParams = new URLSearchParams()
  if (params.pageNumber) searchParams.set('page', String(params.pageNumber))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))

  return useQuery({
    queryKey: ['pagos', params.pageNumber, params.pageSize, params.socioId],
    queryFn: () =>
      api.get<PagedResult<Pago>>(`/api/v1/Pagos/socio/${params.socioId}?${searchParams}`),
    enabled: !!params.socioId
  })
}
