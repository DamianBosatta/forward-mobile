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

/**
 * Tipos que se ofrecen al crear un evento: los mismos tres para todos, como la web
 * (`TIPOS_MANUALES` de forward-frontend/apps/web/src/features/calendario/core/domain/presentacion.ts).
 * La web no filtra los tipos por rol; solo la visibilidad "Administración" depende del puesto.
 */
export type TipoManual = Extract<EventoCalendario['tipo'], 'ServicioRecurrente' | 'ObligacionPeriodica' | 'Manual'>
export const TIPOS_MANUALES: { value: TipoManual; label: string }[] = [
  { value: 'ServicioRecurrente', label: 'Servicio (luz, gas, internet…)' },
  { value: 'ObligacionPeriodica', label: 'Obligación periódica (VTV, impuestos…)' },
  { value: 'Manual', label: 'Otro evento' },
]

/** "HH:mm" de 00:00 a 23:59, como lo pide el servidor (9C). Vacía = todo el día. */
export const esHoraValida = (hora: string) => hora === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)

/** Días de la semana para "Se repite", de lunes a domingo; el valor es el del servidor (0 = domingo). */
export const DIAS_SEMANA: { valor: number; corto: string; largo: string }[] = [
  { valor: 1, corto: 'L', largo: 'Lunes' },
  { valor: 2, corto: 'M', largo: 'Martes' },
  { valor: 3, corto: 'X', largo: 'Miércoles' },
  { valor: 4, corto: 'J', largo: 'Jueves' },
  { valor: 5, corto: 'V', largo: 'Viernes' },
  { valor: 6, corto: 'S', largo: 'Sábado' },
  { valor: 0, corto: 'D', largo: 'Domingo' },
]

/** Día de la semana (0 = domingo) de un YYYY-MM-DD, sin huso: es un día de calendario. */
export const diaDeLaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay()

/** "Se repite todos los viernes" / "los lunes y jueves", como la lámina. */
export function textoSemanal(dias: number[]): string {
  const nombres = DIAS_SEMANA.filter((d) => dias.includes(d.valor)).map((d) => `${d.largo.toLowerCase()}s`.replace(/ss$/, 's'))
  if (nombres.length === 0) return 'Se repite todas las semanas'
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return `Se repite todos los ${lista}`
}
