import { storage } from '@/core/utils/storage'
import { nuevaClaveIdempotencia } from '@/core/utils/idempotencia'

/**
 * Las claves de idempotencia de lo que el chofer reporta en una parada (cobro, entrega, aviso), guardadas en el MMKV
 * cifrado del teléfono y no en memoria (RED-08): si la app se cierra después de un intento sin respuesta, el reintento
 * sale con la misma clave y el servidor no lo graba dos veces. Una lista por usuario, como la cola de la consola.
 *
 * `uso` dice de qué es la clave: `cobro:<paradaCobroId>`, `entrega:<paradaId>`, `aviso:<paradaId>`.
 * Se borra cuando el servidor confirma (o cuando la clave ya no sirve); lo que nadie borró se olvida a los 7 días.
 */

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

/** La clave guardada para ese uso, o una nueva que queda guardada antes de devolverla. */
export function claveDeParada(usuarioId: string, uso: string, ahora = Date.now()): string {
  const guardadas = leer(usuarioId)
  const ya = guardadas[uso]
  if (ya && ahora - ya.en < VIGENCIA_MS) return ya.clave
  const vigentes = Object.fromEntries(Object.entries(guardadas).filter(([, g]) => ahora - g.en < VIGENCIA_MS))
  const clave = nuevaClaveIdempotencia()
  escribir(usuarioId, { ...vigentes, [uso]: { clave, en: ahora } })
  return clave
}

/** El servidor confirmó (o la clave ya no sirve): el próximo reporte de ese uso sale con una clave nueva. */
export function olvidarClaveDeParada(usuarioId: string, uso: string): void {
  const guardadas = leer(usuarioId)
  if (!(uso in guardadas)) return
  delete guardadas[uso]
  escribir(usuarioId, guardadas)
}
