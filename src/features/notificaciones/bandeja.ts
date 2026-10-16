import { diaArgentina, partesArgentina } from '@/src/utils/date'
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

const MS_POR_DIA = 24 * 60 * 60 * 1000
const dos = (n: number) => String(n).padStart(2, '0')

/** "Hoy 09:05", "Ayer 23:30" o "2/10 18:10", en hora argentina. El servidor manda UTC, a veces sin zona. */
export function cuandoFue(fecha: string, ahoraMs: number): string {
  const conZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(fecha) ? fecha : `${fecha}Z`
  const ms = Date.parse(conZona)
  if (Number.isNaN(ms)) return ''
  const p = partesArgentina(ms)
  const hora = `${dos(p.hora)}:${dos(p.minuto)}`
  const dia = diaArgentina(ms)
  if (dia === diaArgentina(ahoraMs)) return `Hoy ${hora}`
  if (dia === diaArgentina(ahoraMs - MS_POR_DIA)) return `Ayer ${hora}`
  return `${p.dia}/${p.mes + 1} ${hora}`
}
