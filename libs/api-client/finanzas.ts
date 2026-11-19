import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { conClave, crearIntento } from '@/core/utils/idempotencia'
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

/** Una clave por intento: el reintento o el doble toque de la misma apertura manda la misma (ver `crearIntento`). */
const intentoAbrirCaja = crearIntento()

export function useAbrirCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saldoInicial: number) =>
      conClave(intentoAbrirCaja, { saldoInicial }, (cuerpo) => api.post<string>('/api/v1/Cajas/abrir', cuerpo)),
    onSuccess: () => invalidarCaja(queryClient),
  })
}


// ── Pagos & Cuentas Corrientes ──────────────────────────────────────────────
