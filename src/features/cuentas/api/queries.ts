import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  LiquidezConsolidadaDto,
  EstadoCuentaDto,
  CreateCuentaCorrientePayload,
} from '@/libs/api-client/types'

// ─── Re-exports for consumers that import from this module directly ────────────
export type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  LiquidezConsolidadaDto,
  EstadoCuentaDto,
  CreateCuentaCorrientePayload,
}

// Backward-compatible aliases — remove after all call sites are updated.
export type CuentaCorrienteResumen = CuentaCorrienteResumenDto
export type MovimientoCuentaDetalle = MovimientoCuentaDto
export type GetMovimientosCuentaResponse = GetMovimientosCuentaDto

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const cuentasKeys = {
  all: ['cuentas-corrientes'] as const,
  lists: () => [...cuentasKeys.all, 'list'] as const,
  propias: (activo?: boolean) => [...cuentasKeys.lists(), 'propias', activo] as const,
  clientes: (activo?: boolean) => [...cuentasKeys.lists(), 'clientes', activo] as const,
  proveedores: (activo?: boolean) => [...cuentasKeys.lists(), 'proveedores', activo] as const,
  movimientos: (id: string) => [...cuentasKeys.all, 'detail', id, 'movimientos'] as const,
  liquidez: () => [...cuentasKeys.all, 'liquidez'] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCuentasPropias(activo: boolean = true) {
  return useQuery({
    queryKey: cuentasKeys.propias(activo),
    queryFn: async () => {
      const res = await api.get<CuentaCorrienteResumenDto[]>(`/api/v1/cuentas-corrientes/propias?activo=${activo}`)
      return res
    },
    staleTime: 30_000,
  })
}

export function useCuentasClientes(activo: boolean = true) {
  return useQuery({
    queryKey: cuentasKeys.clientes(activo),
    queryFn: async () => {
      const res = await api.get<CuentaCorrienteResumenDto[]>(`/api/v1/cuentas-corrientes/clientes?activo=${activo}`)
      return res
    },
    staleTime: 30_000,
  })
}

export function useCuentasProveedores(activo: boolean = true) {
  return useQuery({
    queryKey: cuentasKeys.proveedores(activo),
    queryFn: async () => {
      const res = await api.get<CuentaCorrienteResumenDto[]>(`/api/v1/cuentas-corrientes/proveedores?activo=${activo}`)
      return res
    },
    staleTime: 30_000,
  })
}

export function useLiquidez() {
  return useQuery({
    queryKey: cuentasKeys.liquidez(),
    queryFn: async () => {
      const res = await api.get<LiquidezConsolidadaDto>('/api/v1/cuentas-corrientes/liquidez')
      return res
    },
    staleTime: 30_000,
  })
}

export function useCuentaMovimientos(cuentaId: string) {
  return useInfiniteQuery({
    queryKey: cuentasKeys.movimientos(cuentaId),
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get<GetMovimientosCuentaDto>(
        `/api/v1/cuentas-corrientes/${cuentaId}/movimientos?pageNumber=${pageParam}&pageSize=20`
      )
      return res
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.movimientos) return undefined
      const { page, totalPages } = lastPage.movimientos
      return page && totalPages && page < totalPages ? page + 1 : undefined
    },
    initialPageParam: 1,
    enabled: !!cuentaId,
    staleTime: 15_000,
  })
}

export function useCreateCuentaCorriente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCuentaCorrientePayload) =>
      api.post<string>('/api/v1/cuentas-corrientes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}

export function useDesactivarCuenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cuentaId: string) =>
      api.patch<string>(`/api/v1/cuentas-corrientes/${cuentaId}/desactivar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}

export function useActivarCuenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cuentaId: string) =>
      api.patch<string>(`/api/v1/cuentas-corrientes/${cuentaId}/activar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}

export interface RegistrarPagoPayload {
  socioComercialId: string
  monto: number
  medioPago: string
  moneda?: string
  referencia?: string
  /** Authenticated user id — determines which open caja gets impacted. */
  usuarioId: string
}

/**
 * Registra un cobro/pago para un socio: asienta un movimiento (haber) en la
 * cuenta corriente principal del socio e impacta la caja abierta del usuario.
 * Requiere caja abierta (validado por el servidor).
 */
export function useRegistrarPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegistrarPagoPayload) =>
      api.post<string>('/api/v1/Pagos', {
        moneda: 'ARS',
        referencia: 'Ingreso a cuenta corriente',
        ...payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}
