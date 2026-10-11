import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseDateSafe, partesArgentina } from '@/src/utils/date'

export interface SeccionDia<T> {
  titulo: string
  data: T[]
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Número de día (sin hora) del calendario argentino de un instante; sirve para restar días. */
function numeroDeDiaArgentina(ms: number): number {
  const p = partesArgentina(ms)
  return Date.UTC(p.anio, p.mes, p.dia) / MS_POR_DIA
}

/** "Hoy", "Ayer" o la fecha ("jue 8 de octubre"), según el día calendario de Argentina (el del servidor). */
export function tituloDelDia(fecha: Date, ahora: Date = new Date()): string {
  const dias = numeroDeDiaArgentina(ahora.getTime()) - numeroDeDiaArgentina(fecha.getTime())
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  const f = partesArgentina(fecha.getTime())
  const mismoAnio = f.anio === partesArgentina(ahora.getTime()).anio
  // Fecha local con los mismos año/mes/día argentinos, solo para dar formato.
  return format(new Date(f.anio, f.mes, f.dia), mismoAnio ? "EEE d 'de' MMMM" : "EEE d 'de' MMMM 'de' yyyy", { locale: es })
}

/**
 * Agrupa por día manteniendo el orden del servidor (ya viene de la más nueva a la más vieja).
 * Un documento sin fecha válida va a "Sin fecha", al final.
 */
export function agruparPorDia<T>(items: T[], fechaDe: (item: T) => string | null | undefined, ahora: Date = new Date()): SeccionDia<T>[] {
  const secciones: SeccionDia<T>[] = []
  const sinFecha: T[] = []
  for (const item of items) {
    const fecha = parseDateSafe(fechaDe(item))
    if (!fecha) {
      sinFecha.push(item)
      continue
    }
    const titulo = tituloDelDia(fecha, ahora)
    const ultima = secciones[secciones.length - 1]
    if (ultima?.titulo === titulo) ultima.data.push(item)
    else secciones.push({ titulo, data: [item] })
  }
  if (sinFecha.length) secciones.push({ titulo: 'Sin fecha', data: sinFecha })
  return secciones
}

/** Hora argentina "HH:mm" del documento, o cadena vacía si no hay fecha. */
export function horaDe(iso: string | null | undefined): string {
  const fecha = parseDateSafe(iso)
  if (!fecha) return ''
  const { hora, minuto } = partesArgentina(fecha.getTime())
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}
