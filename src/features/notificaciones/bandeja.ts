import { diaArgentina, partesArgentina } from '@/src/utils/date'
import { diaDe } from '@/features/calendario/semana'
import { RUTA_POR_DESTINO, rutaDeAccion, type AccionSugerida } from './avisos'

/**
 * Qué hace tocar un aviso. `web`: el servidor propone una acción que mobile no tiene (talonarios,
 * caja, solicitudes…): se dice que se abre desde la web en vez de navegar a una pantalla rota.
 * `ninguno`: informativo, o una ficha sin id (no hay adónde ir ni nada que prometer).
 */
export type DestinoAviso =
  | { tipo: 'ruta'; ruta: string; etiqueta: string }
  | { tipo: 'web'; etiqueta: string }
  | { tipo: 'ninguno' }

export function destinoDelAviso(accion: AccionSugerida | null | undefined): DestinoAviso {
  if (!accion) return { tipo: 'ninguno' }
  const ruta = rutaDeAccion(accion)
  if (ruta) return { tipo: 'ruta', ruta, etiqueta: accion.etiqueta }
  // Una ficha sin id (Venta, Compra) tiene pantalla en mobile: lo que falta es el dato, no la web.
  const conocido = Object.prototype.hasOwnProperty.call(RUTA_POR_DESTINO, accion.destino)
  if (conocido && RUTA_POR_DESTINO[accion.destino]('id') !== null) return { tipo: 'ninguno' }
  return { tipo: 'web', etiqueta: accion.etiqueta }
}

/**
 * Adónde lleva tocar un aviso, desde la bandeja o desde un push: la pantalla de mobile de su
 * acción, o `null` si no hay (informativo, de la web o una ficha sin id).
 */
export function rutaAlTocarAviso(accion: AccionSugerida | null | undefined): string | null {
  const destino = destinoDelAviso(accion)
  return destino.tipo === 'ruta' ? destino.ruta : null
}

const MS_POR_DIA = 24 * 60 * 60 * 1000
const dos = (n: number) => String(n).padStart(2, '0')

/** Instante de un aviso en ms. El servidor manda UTC, a veces sin zona; NaN si no se puede leer. */
const msDelAviso = (fecha: string) => Date.parse(/([zZ]|[+-]\d{2}:?\d{2})$/.test(fecha) ? fecha : `${fecha}Z`)

/** "09:05", en hora argentina; vacío si la fecha no se lee. */
export function horaDelAviso(fecha: string): string {
  const ms = msDelAviso(fecha)
  if (Number.isNaN(ms)) return ''
  const p = partesArgentina(ms)
  return `${dos(p.hora)}:${dos(p.minuto)}`
}

/** "Hoy 09:05", "Ayer 23:30" o "2/10 18:10", en hora argentina. El servidor manda UTC, a veces sin zona. */
export function cuandoFue(fecha: string, ahoraMs: number): string {
  const ms = msDelAviso(fecha)
  if (Number.isNaN(ms)) return ''
  const p = partesArgentina(ms)
  const hora = `${dos(p.hora)}:${dos(p.minuto)}`
  const dia = diaArgentina(ms)
  if (dia === diaArgentina(ahoraMs)) return `Hoy ${hora}`
  if (dia === diaArgentina(ahoraMs - MS_POR_DIA)) return `Ayer ${hora}`
  return `${p.dia}/${p.mes + 1} ${hora}`
}

/** "HOY · VIERNES 30/10", "AYER · JUEVES 29/10" o "MARTES 27/10": el encabezado de cada día de la bandeja. */
export function encabezadoDeDia(ms: number, ahoraMs: number): string {
  const d = diaDe(ms)
  const dia = diaArgentina(ms)
  const base = `${d.largo} ${d.numero}/${d.mes + 1}`.toUpperCase()
  if (dia === diaArgentina(ahoraMs)) return `HOY · ${base}`
  if (dia === diaArgentina(ahoraMs - MS_POR_DIA)) return `AYER · ${base}`
  return base
}

export type FilaDeBandeja<T> = { tipo: 'dia'; clave: string; titulo: string } | { tipo: 'aviso'; clave: string; aviso: T }

/** La lista de la bandeja con un encabezado por día argentino (los avisos ya vienen del más nuevo al más viejo). */
export function conEncabezadosDeDia<T extends { id: string; fechaCreacion: string }>(avisos: T[], ahoraMs: number): FilaDeBandeja<T>[] {
  const filas: FilaDeBandeja<T>[] = []
  let anterior = ''
  for (const aviso of avisos) {
    const ms = msDelAviso(aviso.fechaCreacion)
    const dia = Number.isNaN(ms) ? '' : diaArgentina(ms)
    if (dia && dia !== anterior) filas.push({ tipo: 'dia', clave: `dia-${dia}`, titulo: encabezadoDeDia(ms, ahoraMs) })
    if (dia) anterior = dia
    filas.push({ tipo: 'aviso', clave: aviso.id, aviso })
  }
  return filas
}
