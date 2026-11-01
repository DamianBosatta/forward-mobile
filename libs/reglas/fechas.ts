/*
 * Pure converters for bare calendar days (`'yyyy-MM-dd'`, no timezone). They convert between that
 * string, the local-midnight `Date` a calendar widget needs, and what a person types or reads.
 * They never ask the clock for a day: "today" and every Argentine-day rule live in
 * `apps/web/src/shared/lib/argentina-date.ts`.
 */

export const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const ANIO_PRIMERO = /^(\d{4})[\s\-/.](\d{1,2})[\s\-/.](\d{1,2})$/
const DIA_PRIMERO = /^(\d{1,2})[\s\-/.](\d{1,2})[\s\-/.](\d{4})$/

const pad = (n: number, largo = 2) => String(n).padStart(largo, '0')

function armarDia(anio: number, mes: number, dia: number): string | null {
  const fecha = new Date(anio, mes - 1, dia)
  const existe =
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
  return existe ? `${pad(anio, 4)}-${pad(mes)}-${pad(dia)}` : null
}

/** `'yyyy-MM-dd'` to the calendar's local-midnight `Date`; `undefined` if empty or not a real day. */
export function diaAFecha(dia: string): Date | undefined {
  const partes = DIA_ISO.exec(dia)
  if (!partes || armarDia(+partes[1], +partes[2], +partes[3]) === null) return undefined
  return new Date(+partes[1], +partes[2] - 1, +partes[3])
}

/** A calendar `Date` (local midnight) to `'yyyy-MM-dd'`. */
export function fechaADia(fecha: Date): string {
  return `${pad(fecha.getFullYear(), 4)}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
}

/** `'yyyy-MM-dd'` to what the field shows, `'dd/MM/aaaa'`. Anything else shows empty. */
export function diaATexto(dia: string): string {
  const partes = DIA_ISO.exec(dia)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : ''
}

/**
 * What the person typed to `'yyyy-MM-dd'`, or `null` when it is not a real day.
 * Accepts day first (`15/1/2026`, `15-01-2026`, `15 01 2026`, `15.01.2026`) and year first
 * (`2026-01-15`, `2026 01 15`). Compact forms without separators (`15012026`) are rejected
 * on purpose: `20122026` reads as two different days.
 */
export function textoADia(texto: string): string | null {
  const t = texto.trim()
  const anioPrimero = ANIO_PRIMERO.exec(t)
  if (anioPrimero) return armarDia(+anioPrimero[1], +anioPrimero[2], +anioPrimero[3])
  const diaPrimero = DIA_PRIMERO.exec(t)
  if (diaPrimero) return armarDia(+diaPrimero[3], +diaPrimero[2], +diaPrimero[1])
  return null
}
