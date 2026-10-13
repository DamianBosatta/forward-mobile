import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  EstadoCuentaDto,
  MovimientoSocioDto,
  MovimientoSocioDtoPaginatedResponse,
  TipoCuentaSocio,
} from '@/libs/api-client/types'

// ─── Re-exports for consumers that import from this module directly ────────────
export type {
  CuentaCorrienteResumenDto,
  MovimientoCuentaDto,
  GetMovimientosCuentaDto,
  EstadoCuentaDto,
  MovimientoSocioDto,
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
  movimientos: (id: string) => [...cuentasKeys.all, 'detail', id, 'movimientos'] as const,
  movimientosSocio: (socioId: string, cuenta: 'ambas' | TipoCuentaSocio) =>
    [...cuentasKeys.all, 'socio', socioId, 'movimientos', cuenta] as const,
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

/**
 * Movimientos de las DOS cuentas de un socio en una sola lista paginada (forward-system #905): del más
 * nuevo al más viejo, de a 20, con el vencimiento y a qué se aplicó cada crédito. `cuenta` deja una sola.
 *
 * La primera página es la que decide si el endpoint sirve: cualquier falla (404 de un servidor que no lo
 * tiene, 500, sin red, timeout) o una respuesta que no es una página da `null` y la pantalla vuelve a
 * pedir cada cuenta por separado, así que un problema de este endpoint nunca rompe la cuenta corriente.
 * Una falla en la página 2 o posterior sí es un error: la lista ya mostrada se conserva y se puede reintentar.
 */
export function useMovimientosSocio(socioId: string, cuenta: 'ambas' | TipoCuentaSocio, enabled = true) {
  return useInfiniteQuery({
    queryKey: cuentasKeys.movimientosSocio(socioId, cuenta),
    queryFn: async ({ pageParam = 1 }): Promise<MovimientoSocioDtoPaginatedResponse | null> => {
      const filtro = cuenta === 'ambas' ? '' : `&cuenta=${cuenta}`
      try {
        const res = await api.get<MovimientoSocioDtoPaginatedResponse>(
          `/api/v1/cuentas-corrientes/socios/${socioId}/movimientos?pageNumber=${pageParam}&pageSize=20${filtro}`,
          { estadosEsperados: [404] },
        )
        if (Array.isArray(res?.items)) return res
        if (pageParam > 1) throw new Error('Respuesta inesperada del servidor.')
        return null
      } catch (e) {
        if (pageParam > 1) throw e
        return null
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined
      const { page, totalPages } = lastPage
      return page && totalPages && page < totalPages ? page + 1 : undefined
    },
    initialPageParam: 1,
    enabled: enabled && !!socioId,
    staleTime: 15_000,
  })
}
