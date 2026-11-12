/**
 * Horario de entrega del cliente: el servidor guarda una franja por día (`dia` 0 = domingo … 6 = sábado)
 * y la app lo edita en filas "días + desde/hasta". Funciones puras: agrupar, expandir, validar y el texto corto.
 */
export interface FranjaDia { dia: number; desde: string; hasta: string }
export interface FilaHorario { dias: number[]; desde: string; hasta: string }

/** Lunes primero, domingo al final: es el orden en que se muestran y se agrupan los días. */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] as const
const LETRAS: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' }
const NOMBRES: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' }

export const letraDelDia = (dia: number) => LETRAS[dia] ?? '?'
export const nombreDelDia = (dia: number) => NOMBRES[dia] ?? ''
const posicion = (dia: number) => ORDEN_DIAS.indexOf(dia as (typeof ORDEN_DIAS)[number])
const porDia = (a: number, b: number) => posicion(a) - posicion(b)

const hhmm = (h: string) => h.slice(0, 5)
const aMinutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))

/** Normaliza lo tipeado ("8", "8:30", "1530") a "HH:mm"; null si no es una hora. */
export function horaValida(texto: string): string | null {
  const t = texto.trim()
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] === undefined ? 0 : Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Junta en una fila los días que tienen el mismo desde y hasta. */
export function agruparFranjas(franjas: readonly FranjaDia[] | null | undefined): FilaHorario[] {
  const filas = new Map<string, FilaHorario>()
  for (const f of franjas ?? []) {
    const desde = hhmm(f.desde)
    const hasta = hhmm(f.hasta)
    const clave = `${desde}|${hasta}`
    const fila = filas.get(clave) ?? { dias: [], desde, hasta }
    if (!fila.dias.includes(f.dia)) fila.dias.push(f.dia)
    filas.set(clave, fila)
  }
  return [...filas.values()]
    .map(fila => ({ ...fila, dias: [...fila.dias].sort(porDia) }))
    .sort((a, b) => porDia(a.dias[0] ?? 0, b.dias[0] ?? 0) || a.desde.localeCompare(b.desde))
}

/** Abre cada fila en una franja por día, ordenadas por día y hora. */
export function expandirFilas(filas: readonly FilaHorario[]): FranjaDia[] {
  return filas
    .flatMap(fila => fila.dias.map(dia => ({ dia, desde: fila.desde, hasta: fila.hasta })))
    .sort((a, b) => porDia(a.dia, b.dia) || a.desde.localeCompare(b.desde))
}

const hora = (h: string) => (h.slice(3, 5) === '00' ? h.slice(0, 2) : hhmm(h))
const rango = (desde: string, hasta: string) => `${hora(desde)} a ${hora(hasta)}`

function textoDeDias(dias: number[]): string {
  const orden = [...dias].sort(porDia)
  const tramos: string[] = []
  let i = 0
  while (i < orden.length) {
    let j = i
    while (j + 1 < orden.length && posicion(orden[j + 1]) === posicion(orden[j]) + 1) j++
    tramos.push(j > i ? `${letraDelDia(orden[i])} a ${letraDelDia(orden[j])}` : letraDelDia(orden[i]))
    i = j + 1
  }
  return tramos.join(', ')
}

/** "L a V 08 a 12 y 15 a 19 · S 09 a 13"; null si no hay horario. */
export function textoHorario(franjas: readonly FranjaDia[] | null | undefined): string | null {
  if (!franjas || franjas.length === 0) return null
  const rangosPorDia = new Map<number, FranjaDia[]>()
  for (const f of franjas) rangosPorDia.set(f.dia, [...(rangosPorDia.get(f.dia) ?? []), f])
  const grupos = new Map<string, { dias: number[]; texto: string }>()
  for (const [dia, lista] of rangosPorDia) {
    const texto = [...lista].sort((a, b) => a.desde.localeCompare(b.desde)).map(f => rango(f.desde, f.hasta)).join(' y ')
    const g = grupos.get(texto) ?? { dias: [], texto }
    g.dias.push(dia)
    grupos.set(texto, g)
  }
  return [...grupos.values()]
    .sort((a, b) => Math.min(...a.dias.map(posicion)) - Math.min(...b.dias.map(posicion)))
    .map(g => `${textoDeDias(g.dias)} ${g.texto}`)
    .join(' · ')
}

export const ERROR_SIN_DIAS = 'Elegí al menos un día.'
export const ERROR_HORA = 'Completá el horario con formato 08:00.'
export const ERROR_ORDEN = '«Hasta» tiene que ser después de «desde».'
export const ERROR_PISADO = 'Se pisa con otro horario del mismo día.'

/** Un mensaje por fila (null si está bien): sin días, hora inválida, hasta <= desde o rangos que se pisan en un día. */
export function validarFilas(filas: readonly FilaHorario[]): (string | null)[] {
  const propio = filas.map(f => {
    if (f.dias.length === 0) return ERROR_SIN_DIAS
    const d = horaValida(f.desde)
    const h = horaValida(f.hasta)
    if (!d || !h) return ERROR_HORA
    return aMinutos(h) > aMinutos(d) ? null : ERROR_ORDEN
  })
  return filas.map((f, i) => {
    if (propio[i]) return propio[i]
    const pisa = filas.some((o, j) =>
      j !== i && !propio[j] && o.dias.some(d => f.dias.includes(d)) &&
      aMinutos(horaValida(f.desde)!) < aMinutos(horaValida(o.hasta)!) && aMinutos(horaValida(o.desde)!) < aMinutos(horaValida(f.hasta)!))
    return pisa ? ERROR_PISADO : null
  })
}
