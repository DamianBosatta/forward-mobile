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

/** Corre un día YYYY-MM-DD (mediodía argentino, para no cruzar de día). */
export function moverDia(fecha: string, dias: number): DiaSemana {
  return diaDe(Date.parse(`${fecha}T15:00:00Z`), dias)
}

/** Un mes mostrado en grilla: sus semanas de lunes a domingo, con los días de los meses vecinos que completan la primera y la última. */
export interface MesGrilla {
  titulo: string
  /** Primer y último día de la grilla (YYYY-MM-DD), para pedir el rango al servidor. */
  desde: string
  hasta: string
  /** `delMes` es false en los días de relleno. */
  semanas: (DiaSemana & { delMes: boolean })[][]
}

/** El mes de `ms` corrido `meses` meses (días argentinos). "Octubre 2026" empieza un jueves: la grilla arranca el lunes 28 de septiembre. */
export function mesDe(ms: number, meses = 0): MesGrilla {
  const hoy = partesArgentina(ms)
  const total = hoy.anio * 12 + hoy.mes + meses
  const anio = Math.floor(total / 12)
  const mes = total - anio * 12
  const primero = `${anio}-${dos(mes + 1)}-01`
  const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const arranque = (new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7
  const cantidad = Math.ceil((arranque + diasDelMes) / 7) * 7
  const base = Date.parse(`${primero}T15:00:00Z`)
  const dias = Array.from({ length: cantidad }, (_, i) => {
    const d = diaDe(base, i - arranque)
    return { ...d, delMes: d.mes === mes }
  })
  return {
    titulo: `${MESES[mes][0].toUpperCase()}${MESES[mes].slice(1)} ${anio}`,
    desde: dias[0].fecha,
    hasta: dias[dias.length - 1].fecha,
    semanas: Array.from({ length: cantidad / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7)),
  }
}
