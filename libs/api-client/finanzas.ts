import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CajaActivaDto, MovimientoCajaDto, KpiDashboard, ReporteDiario, Pago, MovimientoCuenta, PagedResult } from './types'

export const finanzasKeys = {
  cajaActiva: ['caja', 'activa'] as const,
  cajas: ['cajas'] as const,
  movimientosCaja: (cajaId: string) => ['caja', cajaId, 'movimientos'] as const,
  kpi: ['kpi', 'dashboard'] as const,
  reporteDiario: (fecha: string) => ['reporte', 'diario', fecha] as const,
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
      api.post<string>(`/api/v1/Cajas/${cajaId}/cerrar`, { saldoFinalDeclarado }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: finanzasKeys.cajaActiva }),
  })
}

// ── KPI Dashboard ──────────────────────────────────────────────────────────

export function useKpiDashboard() {
  return useQuery({
    queryKey: finanzasKeys.kpi,
    queryFn: () => api.get<KpiDashboard>('/api/v1/dashboard/summary'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

// ── Reporte Diario ──────────────────────────────────────────────────────────

export function useReporteDiario(fecha: string) {
  return useQuery({
    queryKey: finanzasKeys.reporteDiario(fecha),
    queryFn: () => api.get<ReporteDiario>(`/api/v1/Reportes/diario?fecha=${fecha}`),
    enabled: !!fecha,
    staleTime: 5 * 60_000,
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

export function useMovimientosCuenta(entidadId: string) {
  return useQuery({
    queryKey: ['cuentas', entidadId],
    queryFn: () =>
      api.get<MovimientoCuenta[]>(`/api/v1/CuentasCorrientes/socios/${entidadId}/estado-cuenta`),
    enabled: !!entidadId,
  })
}
