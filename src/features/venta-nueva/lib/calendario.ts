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
/** Igual que `CalendarioEntregas.MaximoDiasABuscar` del servidor: más allá es un dato roto, no un calendario. */
const MAX_DIAS_A_BUSCAR = 400

/** Día de la semana (0 domingo) de un "YYYY-MM-DD", sin depender del huso del teléfono. */
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay()

/** Los feriados por día "YYYY-MM-DD" (la fecha del servidor puede venir con hora: se corta). */
const feriadosPorDia = (cal: CalendarioEntregas) => {
  const porDia = new Map<string, string>()
  for (const f of cal.feriados) if (f.fecha) porDia.set(f.fecha.slice(0, 10), f.descripcion?.trim() || 'feriado')
  return porDia
}

/** Hay entregas ese día: su día de semana está habilitado y no es feriado (`EsDiaHabilitado` del servidor). */
const habilitado = (dia: string, cal: CalendarioEntregas, feriados: Map<string, string>) =>
  (cal.dias ? cal.dias[CLAVES[diaSemana(dia)]] === true : true) && !feriados.has(dia)

export interface DiaDeLaTira { dia: string; numero: number; nombre: string; habil: boolean; feriado: string | null }

/** Próximos `n` días desde mañana (Argentina). Sin calendario todavía, ninguno se tacha: decide el servidor. */
export function tiraDeDias(ahoraMs: number, cal: CalendarioEntregas, n = 14): DiaDeLaTira[] {
  const feriados = feriadosPorDia(cal)
  return Array.from({ length: n }, (_, i) => {
    const dia = diaArgentina(ahoraMs + (i + 1) * MS_DIA)
    return { dia, numero: Number(dia.slice(8)), nombre: NOMBRES[diaSemana(dia)], habil: habilitado(dia, cal, feriados), feriado: feriados.get(dia) ?? null }
  })
}

/**
 * La fecha que se propone, con la misma regla que el servidor al crear una venta sin fecha:
 * `Venta.FechaEntregaPorDefecto(hoy, calendario)` = `calendario.ProximoDiaHabilitado(hoy + 1)`
 * (Venta.cs:541-542, CalendarioEntregas.cs:73-84). Es decir, el primer día con entregas desde MAÑANA
 * inclusive: hoy no se propone aunque esté habilitado (a diferencia del cierre del día, que arrastra
 * desde hoy: Venta.cs:1142). "Hoy" es el día de Argentina, no el del teléfono. Busca hasta 400
 * días, como el servidor, aunque la tira muestre solo dos semanas. Sin calendario cargado, o sin
 * ningún día habilitado en ese plazo (el servidor falla), ninguna: que elija el vendedor.
 */
export function fechaEntregaPorDefecto(ahoraMs: number, cal: CalendarioEntregas): string | null {
  if (!cal.dias) return null
  const feriados = feriadosPorDia(cal)
  for (let i = 1; i <= MAX_DIAS_A_BUSCAR; i++) {
    const dia = diaArgentina(ahoraMs + i * MS_DIA)
    if (habilitado(dia, cal, feriados)) return dia
  }
  return null
}
