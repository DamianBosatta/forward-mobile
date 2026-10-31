import { diaArgentina, partesArgentina } from '@/src/utils/date'

/** Período del filtro de movimientos de una cuenta corriente. `null` = sin filtro (todo el historial). */
export type PeriodoDeCuenta = 'mesActual' | 'mesAnterior' | 'ultimos90'

export const PERIODOS_DE_CUENTA: { valor: PeriodoDeCuenta; label: string }[] = [
  { valor: 'mesActual', label: 'Este mes' },
  { valor: 'mesAnterior', label: 'Mes anterior' },
  { valor: 'ultimos90', label: 'Últimos 90 días' },
]

/** Días calendario argentinos (YYYY-MM-DD), inclusive, como los interpreta el servidor. */
export interface RangoDeDias {
  desde: string
  hasta: string
}

const MS_POR_DIA = 24 * 60 * 60 * 1000
const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Fechas del período según el día de negocio argentino de `ahoraMs` (regla X9: nunca el huso del teléfono).
 * Mes actual: del 1 a hoy. Mes anterior: del 1 al último día. Últimos 90 días: hoy y los 89 anteriores.
 */
export function rangoDelPeriodo(periodo: PeriodoDeCuenta, ahoraMs: number): RangoDeDias {
  const hoy = diaArgentina(ahoraMs)
  const { anio, mes } = partesArgentina(ahoraMs)
  if (periodo === 'mesActual') return { desde: `${anio}-${dos(mes + 1)}-01`, hasta: hoy }
  if (periodo === 'ultimos90') return { desde: diaArgentina(ahoraMs - 89 * MS_POR_DIA), hasta: hoy }
  const anioPrevio = mes === 0 ? anio - 1 : anio
  const mesPrevio = mes === 0 ? 11 : mes - 1
  const ultimoDia = new Date(Date.UTC(anioPrevio, mesPrevio + 1, 0)).getUTCDate()
  return { desde: `${anioPrevio}-${dos(mesPrevio + 1)}-01`, hasta: `${anioPrevio}-${dos(mesPrevio + 1)}-${dos(ultimoDia)}` }
}
