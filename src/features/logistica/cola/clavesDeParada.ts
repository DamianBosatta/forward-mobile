import { storage } from '@/core/utils/storage'
import { nuevaClaveIdempotencia } from '@/core/utils/idempotencia'
import type { DatosAccion } from './colaConsola'

/**
 * Idempotency keys of what the driver reports at a stop (cobro, entrega, aviso), stored in the phone's encrypted MMKV
 * instead of memory (RED-08): if the app closes after an attempt that got no answer, the retry goes out with the same
 * key and the server does not record it twice. One list per user, like the console queue (kept on logout like it).
 *
 * `uso` says what the key is for: `cobro:<paradaCobroId>`, `entrega:<paradaId>`, `aviso:<paradaId>`.
 * It is dropped when the server confirms (or the key is spent); anything nobody dropped expires after 7 days.
 */

/** What each stop key is for. One place, so the screens and the queue name the same key. */
export const usoEntrega = (paradaId: string) => `entrega:${paradaId}`
export const usoAviso = (paradaId: string) => `aviso:${paradaId}`
export const usoCobro = (paradaCobroId: string) => `cobro:${paradaCobroId}`

/** The stored key a queued action was sent with; `undefined` for "No cobré", whose key is fixed per stop. */
export function usoDeAccion(a: Pick<DatosAccion, 'tipo' | 'paradaId'>): string | undefined {
  switch (a.tipo) {
    case 'entrega': return usoEntrega(a.paradaId)
    case 'noEntrega': return usoAviso(a.paradaId)
    case 'cobroParada': return usoCobro(a.paradaId)
    default: return undefined
  }
}

const VIGENCIA_MS = 7 * 24 * 60 * 60_000
const claveDeLista = (usuarioId: string) => `consola-claves:${usuarioId}`

type Guardadas = Record<string, { clave: string; en: number }>

function leer(usuarioId: string): Guardadas {
  try {
    const v: unknown = JSON.parse(storage.getString(claveDeLista(usuarioId)) ?? '{}')
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
    const buenas: Guardadas = {}
    for (const [uso, x] of Object.entries(v as Record<string, unknown>)) {
      const g = x as { clave?: unknown; en?: unknown } | null
      if (typeof g?.clave === 'string' && g.clave && typeof g.en === 'number') buenas[uso] = { clave: g.clave, en: g.en }
    }
    return buenas
  } catch {
    return {}
  }
}

function escribir(usuarioId: string, guardadas: Guardadas): void {
  if (Object.keys(guardadas).length === 0) storage.remove(claveDeLista(usuarioId))
  else storage.set(claveDeLista(usuarioId), JSON.stringify(guardadas))
}

/** The stored key for that use, or a new one that is stored before it is returned. */
export function claveDeParada(usuarioId: string, uso: string, ahora = Date.now()): string {
  const guardadas = leer(usuarioId)
  const ya = guardadas[uso]
  if (ya && ahora - ya.en < VIGENCIA_MS) return ya.clave
  const vigentes = Object.fromEntries(Object.entries(guardadas).filter(([, g]) => ahora - g.en < VIGENCIA_MS))
  const clave = nuevaClaveIdempotencia()
  escribir(usuarioId, { ...vigentes, [uso]: { clave, en: ahora } })
  return clave
}

/**
 * The server confirmed (or the key is spent): the next report for that use goes out with a new key.
 * With `soloSi`, only that key is forgotten: a newer key stored for the same stop stays.
 */
export function olvidarClaveDeParada(usuarioId: string, uso: string, soloSi?: string): void {
  const guardadas = leer(usuarioId)
  if (!(uso in guardadas)) return
  if (soloSi !== undefined && guardadas[uso].clave !== soloSi) return
  delete guardadas[uso]
  escribir(usuarioId, guardadas)
}
