import { esEstadoVenta } from '@/core/constants/estados'

/** Paso de la línea de tiempo del detalle (0 Confirmada … 3 Entregada); -1 si no está en ella. */
export function pasoDeVenta(estado: string | number | null | undefined): number {
  if (esEstadoVenta(estado, 'Confirmada')) return 0
  if (esEstadoVenta(estado, 'EnPreparacion', 'Empacada')) return 1
  if (esEstadoVenta(estado, 'EnRuta')) return 2
  if (esEstadoVenta(estado, 'Entregada')) return 3
  return -1
}

/** Una venta que ya no sigue su camino: anulada o no entregada. */
export function estaCancelada(estado: string | number | null | undefined): boolean {
  return esEstadoVenta(estado, 'Anulada', 'NoEntregada')
}
