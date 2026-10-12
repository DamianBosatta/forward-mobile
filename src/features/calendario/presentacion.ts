import type { ChipEstado } from '@/libs/theme'
import type { EventoCalendario } from '@/libs/api-client/calendario'

/** Cómo se nombra y se pinta cada estado y cada tipo de evento. */
export const CHIP: Record<EventoCalendario['estado'], { estado: ChipEstado; label: string }> = {
  Pendiente: { estado: 'pendiente', label: 'Pendiente' },
  Pagado: { estado: 'entregado', label: 'Pagado' },
  Vencido: { estado: 'porAutorizar', label: 'Vencido' },
  Cancelado: { estado: 'anulado', label: 'Cancelado' },
}

/** Un recordatorio (no financiero) pagado se lee "Hecho", como en la lámina TabCalendario. */
export function chipDe(e: Pick<EventoCalendario, 'estado' | 'esFinanciero'>) {
  const chip = CHIP[e.estado]
  return chip && e.estado === 'Pagado' && !e.esFinanciero ? { ...chip, label: 'Hecho' } : chip
}

export const TIPO: Record<EventoCalendario['tipo'], string> = {
  VencimientoCompra: 'Vencimiento de compra',
  ChequeEmitido: 'Cheque emitido',
  ChequeRecibido: 'Cheque recibido',
  ServicioRecurrente: 'Servicio',
  ObligacionPeriodica: 'Obligación',
  Manual: 'Recordatorio',
}
