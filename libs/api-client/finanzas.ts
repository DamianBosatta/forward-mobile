import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CajaActivaDto, MovimientoCajaDto, Pago, PagedResult } from './types'
import type { components } from './generated/schema'
import { invalidarCaja } from './invalidaciones'

type CerrarCajaResponseDto = components['schemas']['CerrarCajaResponseDto']

export const finanzasKeys = {
  /** Todas las cajas activas en caché (cualquier depósito): lo que invalidan abrir y cerrar. */
  cajasActivas: ['caja', 'activa'] as const,
  /** La caja abierta de un depósito; sin depósito, la única abierta (como la web: `['caja', 'activa', depositoId]`). */
  cajaActiva: (depositoId?: string) => ['caja', 'activa', depositoId ?? 'unica'] as const,
  cajas: ['cajas'] as const,
  /** Raíz de todo lo de caja: cajas activas y movimientos de cada caja. */
  caja: ['caja'] as const,
  movimientosCaja: (cajaId: string) => ['caja', cajaId, 'movimientos'] as const,
}

// ── Caja ─────────────────────────────────────────────────────────────────────

/**
 * La caja abierta de un depósito (`GET /Cajas/activa?depositoId=`, MOD_PAGOS:Read), como `useCajaActiva` de la web.
 * La caja es del depósito, no de quien la abrió. Sin `depositoId` el servidor resuelve la única abierta y, con más de
 * una, contesta 409. Sin caja abierta contesta 204, que llega como `undefined`: se guarda `null` ("no hay caja"),
 * que es un dato válido y no un error. Sin reintentos: un 409 o un 204 no se arreglan solos.
 */
export function useCajaActiva(depositoId?: string, { enabled = true }: { enabled?: boolean } = {}) {
  const query = depositoId ? `?depositoId=${encodeURIComponent(depositoId)}` : ''
  return useQuery({
    queryKey: finanzasKeys.cajaActiva(depositoId),
    queryFn: async () => (await api.get<CajaActivaDto | null>(`/api/v1/Cajas/activa${query}`)) ?? null,
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
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
    onSuccess: () => invalidarCaja(queryClient),
  })
}

export function useCerrarCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cajaId, saldoFinalDeclarado }: { cajaId: string; saldoFinalDeclarado: number }) =>
      api.post<CerrarCajaResponseDto>('/api/v1/Cajas/cerrar', { cajaId, saldoFinalDeclarado }),
    onSuccess: () => invalidarCaja(queryClient),
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
