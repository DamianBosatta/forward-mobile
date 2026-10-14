import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/**
 * GET /Reportes/mobile/resumen-vendedor (bloque 9, 5.4): ventas, comisiones y cobros pendientes de
 * un mes. El servidor decide el alcance: un vendedor ve siempre lo suyo (el vendedorId se ignora) y
 * gestión ve a todos o al que filtra (`puedeElegirVendedor`). El margen llega solo con CAP_VER_COSTOS.
 */
export type ResumenVendedor = components['schemas']['ResumenVendedorDto']

const reportesKeys = {
  all: ['reportes'] as const,
  resumenVendedor: (anio: number, mes: number, vendedorId: string | null) =>
    [...reportesKeys.all, 'resumen-vendedor', anio, mes, vendedorId] as const,
}

export function useResumenVendedor(anio: number, mes: number, vendedorId: string | null) {
  return useQuery({
    queryKey: reportesKeys.resumenVendedor(anio, mes, vendedorId),
    queryFn: () => api.get<ResumenVendedor>(
      `/api/v1/Reportes/mobile/resumen-vendedor?anio=${anio}&mes=${mes}${vendedorId ? `&vendedorId=${vendedorId}` : ''}`,
    ),
  })
}
