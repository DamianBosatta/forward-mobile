import { diaArgentina, partesArgentina } from '@/src/utils/date'

const DIA_MS = 24 * 60 * 60 * 1000

/** "AAAA-MM-DD" argentino de hoy: el servidor toma de ahí la semana (lunes a domingo). */
export const diaDeLaSemana = (ms: number) => diaArgentina(ms)

/** "Semana del 26/10 al 1/11": el lunes y el domingo argentinos de la semana de un instante. */
export function tituloSemana(ms: number): string {
  const atras = (partesArgentina(ms).diaSemana + 6) % 7 // lunes = 0 … domingo = 6
  const lunes = partesArgentina(ms - atras * DIA_MS)
  const domingo = partesArgentina(ms + (6 - atras) * DIA_MS)
  return `Semana del ${lunes.dia}/${lunes.mes + 1} al ${domingo.dia}/${domingo.mes + 1}`
}
