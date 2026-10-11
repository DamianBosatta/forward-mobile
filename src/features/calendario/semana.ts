import { partesArgentina } from '@/src/utils/date'

export interface DiaSemana {
  /** YYYY-MM-DD del calendario argentino. */
  fecha: string
  numero: number
  /** "lun", "mar"… */
  corto: string
  /** "Lunes"… */
  largo: string
  mes: number
}

const CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MS_POR_DIA = 24 * 60 * 60 * 1000
const dos = (n: number) => String(n).padStart(2, '0')

/** Un día YYYY-MM-DD del calendario argentino, desplazado `dias` días. */
export function diaDe(ms: number, dias = 0): DiaSemana {
  const p = partesArgentina(ms + dias * MS_POR_DIA)
  return {
    fecha: `${p.anio}-${dos(p.mes + 1)}-${dos(p.dia)}`,
    numero: p.dia,
    corto: CORTO[p.diaSemana],
    largo: LARGO[p.diaSemana],
    mes: p.mes,
  }
}

/** Los 7 días (lunes a domingo, en Argentina) de la semana de `ms`, corrida `semanas` semanas. */
export function semanaDe(ms: number, semanas = 0): DiaSemana[] {
  const { diaSemana } = partesArgentina(ms)
  const alLunes = -((diaSemana + 6) % 7) + semanas * 7
  return Array.from({ length: 7 }, (_, i) => diaDe(ms, alLunes + i))
}

/** "Semana del 5 al 11 de octubre" o "Semana del 29 de septiembre al 5 de octubre". */
export function tituloSemana(dias: DiaSemana[]): string {
  const [a, b] = [dias[0], dias[dias.length - 1]]
  const desde = a.mes === b.mes ? `${a.numero}` : `${a.numero} de ${MESES[a.mes]}`
  return `Semana del ${desde} al ${b.numero} de ${MESES[b.mes]}`
}

/** "Martes 13 de octubre". */
export function nombreLargo(d: DiaSemana): string {
  return `${d.largo} ${d.numero} de ${MESES[d.mes]}`
}
