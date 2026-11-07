import { PARADA_COBRO_PENDIENTE, type ParadaCobro } from '@/features/cobros/paradaCobro'

/** Cuántas paradas de solo cobro siguen sin resolver (ni cobradas ni no cobradas). */
export const paradasCobroSinResolver = (paradas: ParadaCobro[] | undefined): number =>
  (paradas ?? []).filter((p) => p.estado === PARADA_COBRO_PENDIENTE).length

/**
 * Aviso al finalizar el viaje (S26, "Permitir con aviso"): el servidor deja cerrar igual; la app avisa cuántas quedan y
 * que esas tareas vuelven a pendientes. Con 0 no hay aviso (`null`).
 */
export function avisoDeFinalizar(sinResolver: number): { titulo: string; detalle: string } | null {
  if (sinResolver <= 0) return null
  return sinResolver === 1
    ? { titulo: 'Queda 1 parada de cobro sin resolver.', detalle: 'Si finalizás igual, esa tarea vuelve a quedar pendiente.' }
    : { titulo: `Quedan ${sinResolver} paradas de cobro sin resolver.`, detalle: 'Si finalizás igual, esas tareas vuelven a quedar pendientes.' }
}
