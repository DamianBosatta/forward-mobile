import { differenceInCalendarDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseDateSafe } from '@/src/utils/date'

export interface SeccionDia<T> {
  titulo: string
  data: T[]
}

/** "Hoy", "Ayer" o la fecha ("jue 8 de octubre"), según el día calendario del teléfono. */
export function tituloDelDia(fecha: Date, ahora: Date = new Date()): string {
  const dias = differenceInCalendarDays(ahora, fecha)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  const mismoAnio = fecha.getFullYear() === ahora.getFullYear()
  return format(fecha, mismoAnio ? "EEE d 'de' MMMM" : "EEE d 'de' MMMM 'de' yyyy", { locale: es })
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

/** Hora local "HH:mm" del documento, o cadena vacía si no hay fecha. */
export function horaDe(iso: string | null | undefined): string {
  const fecha = parseDateSafe(iso)
  return fecha ? format(fecha, 'HH:mm') : ''
}
