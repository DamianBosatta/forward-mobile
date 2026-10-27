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
  resumenVendedor: (periodo: PeriodoResumen, vendedorId: string | null) =>
    [...reportesKeys.all, 'resumen-vendedor', periodo, vendedorId] as const,
}

/**
 * Un mes (`anio` y `mes` 1-12) o una semana: `semana` es cualquier día AAAA-MM-DD de la semana pedida
 * (lunes a domingo argentino); con `semana` el servidor ignora año y mes.
 */
export type PeriodoResumen = { anio: number; mes: number } | { semana: string }

export function useResumenVendedor(periodo: PeriodoResumen, vendedorId: string | null) {
  const filtro = 'semana' in periodo ? `semana=${periodo.semana}` : `anio=${periodo.anio}&mes=${periodo.mes}`
  return useQuery({
    queryKey: reportesKeys.resumenVendedor(periodo, vendedorId),
    queryFn: () => api.get<ResumenVendedor>(
      `/api/v1/Reportes/mobile/resumen-vendedor?${filtro}${vendedorId ? `&vendedorId=${vendedorId}` : ''}`,
    ),
  })
}
