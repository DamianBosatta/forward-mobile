import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  EstadoCuentaDto,
} from '@/libs/api-client/types'

// ─── Re-exports for consumers that import from this module directly ────────────
export type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  EstadoCuentaDto,
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
  estadoSocio: (socioId: string) => [...cuentasKeys.all, 'estado-cuenta', socioId] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Estado de cuenta de un socio (saldo actual, a favor y pendientes). Pedirlo solo si el servidor dijo que se puede ver. */
export function useEstadoCuentaSocio(socioId: string, enabled = true) {
  return useQuery({
    queryKey: cuentasKeys.estadoSocio(socioId),
    queryFn: () => api.get<EstadoCuentaDto>(`/api/v1/cuentas-corrientes/socios/${socioId}/estado-cuenta`),
    enabled: enabled && !!socioId,
    staleTime: 30_000,
  })
}

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

/** Movimientos de una cuenta, del más nuevo al más viejo, de a 20 (el servidor pagina y ordena). */
export function useCuentaMovimientos(cuentaId: string | null | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: cuentasKeys.movimientos(cuentaId ?? ''),
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
    enabled: enabled && !!cuentaId,
    staleTime: 15_000,
  })
}
