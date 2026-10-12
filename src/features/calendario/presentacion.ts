import type { ChipEstado } from '@/libs/theme'
import type { EventoCalendario } from '@/libs/api-client/calendario'

/** Cómo se nombra y se pinta cada estado y cada tipo de evento. */
export const CHIP: Record<EventoCalendario['estado'], { estado: ChipEstado; label: string }> = {
  Pendiente: { estado: 'pendiente', label: 'Pendiente' },
  Pagado: { estado: 'entregado', label: 'Pagado' },
  Vencido: { estado: 'porAutorizar', label: 'Vencido' },
  Cancelado: { estado: 'anulado', label: 'Cancelado' },
}

/**
 * Un recordatorio (`tipo` Manual) se marca "hecho", como en la lámina TabCalendario; un servicio,
 * una obligación o un pago, "pagado". El estado es el mismo (`Pagado`). No se mira `esFinanciero`:
 * eso dice si es de Administración, no si es un pago.
 */
export const esRecordatorio = (e: Pick<EventoCalendario, 'tipo'>) => e.tipo === 'Manual'

export function chipDe(e: Pick<EventoCalendario, 'estado' | 'tipo'>) {
  const chip = CHIP[e.estado]
  return chip && e.estado === 'Pagado' && esRecordatorio(e) ? { ...chip, label: 'Hecho' } : chip
}

export const TIPO: Record<EventoCalendario['tipo'], string> = {
  VencimientoCompra: 'Vencimiento de compra',
  ChequeEmitido: 'Cheque emitido',
  ChequeRecibido: 'Cheque recibido',
  ServicioRecurrente: 'Servicio',
  ObligacionPeriodica: 'Obligación',
  Manual: 'Recordatorio',
}
