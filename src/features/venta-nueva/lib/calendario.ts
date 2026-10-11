import { diaArgentina } from '@/src/utils/date'

/**
 * Días de entrega (plan 9 §2.1): los días de semana habilitados en Configuración menos los
 * feriados cargados, igual que la web (dias-entrega.ts) y que el servidor, que es quien decide
 * (rechaza una fecha fuera del calendario). Todo sobre días "YYYY-MM-DD" de Argentina.
 */
export interface DiasDeEntrega { lunes?: boolean; martes?: boolean; miercoles?: boolean; jueves?: boolean; viernes?: boolean; sabado?: boolean; domingo?: boolean }
export interface CalendarioEntregas { dias: DiasDeEntrega | null; feriados: { fecha?: string; descripcion?: string | null }[] }

const CLAVES: (keyof DiasDeEntrega)[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const NOMBRES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MS_DIA = 86_400_000

/** Día de la semana (0 domingo) de un "YYYY-MM-DD", sin depender del huso del teléfono. */
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay()

export interface DiaDeLaTira { dia: string; numero: number; nombre: string; habil: boolean; feriado: string | null }

/** Próximos `n` días desde mañana (Argentina). Sin calendario todavía, ninguno se tacha: decide el servidor. */
export function tiraDeDias(ahoraMs: number, cal: CalendarioEntregas, n = 14): DiaDeLaTira[] {
  return Array.from({ length: n }, (_, i) => {
    const dia = diaArgentina(ahoraMs + (i + 1) * MS_DIA)
    const f = cal.feriados.find((x) => x.fecha?.slice(0, 10) === dia)
    const feriado = f ? (f.descripcion?.trim() || 'feriado') : null
    const habilSemana = cal.dias ? cal.dias[CLAVES[diaSemana(dia)]] === true : true
    return { dia, numero: Number(dia.slice(8)), nombre: NOMBRES[diaSemana(dia)], habil: habilSemana && !feriado, feriado }
  })
}

/** La fecha que se propone: el primer día hábil desde mañana; si no hay ninguno, ninguna (que elija el vendedor). */
export const proximoHabil = (tira: DiaDeLaTira[]) => tira.find((d) => d.habil)?.dia ?? null
