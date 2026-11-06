import { storage } from '@/core/utils/storage'
import type { PosicionViaje } from '@/libs/api-client/types'

/**
 * Posiciones del viaje que todavía no salieron (S5): cada lectura del GPS entra acá con su hora original y sale en
 * lotes (`enviarPosiciones`). Mismo patrón que `cola/colaConsola.ts` (una lista por usuario en el MMKV cifrado; cerrar
 * sesión no la borra y otro usuario del teléfono no la ve ni la manda), pero en su propia clave: esa cola muestra cada
 * acción al chofer, una por parada, y descarta al leer lo que no sea una entrega o un "no entregué".
 */
export type PosicionEnCola = PosicionViaje & { hojaDeRutaId: string }

const claveDeCola = (usuarioId: string) => `posiciones-viaje:${usuarioId}`
const oyentes = new Set<() => void>()

const esPosicion = (v: unknown): v is PosicionEnCola => {
  const p = v as Partial<PosicionEnCola> | null
  return typeof p === 'object' && p !== null && typeof p.hojaDeRutaId === 'string' && typeof p.registradaEn === 'string'
    && typeof p.latitud === 'number' && typeof p.longitud === 'number'
}

const orden = (a: PosicionEnCola, b: PosicionEnCola) => a.registradaEn.localeCompare(b.registradaEn)

/** El texto guardado tal cual (para `useSyncExternalStore`: cambia solo si cambió la cola). */
export const textoDePosiciones = (usuarioId: string | undefined): string | undefined =>
  usuarioId ? storage.getString(claveDeCola(usuarioId)) : undefined

/** Las posiciones del usuario, las más viejas primero. */
export function leerPosiciones(usuarioId: string): PosicionEnCola[] {
  try {
    const lista: unknown = JSON.parse(textoDePosiciones(usuarioId) ?? '[]')
    return Array.isArray(lista) ? lista.filter(esPosicion).sort(orden) : []
  } catch {
    return []
  }
}

function escribir(usuarioId: string, lista: PosicionEnCola[]): void {
  storage.set(claveDeCola(usuarioId), JSON.stringify(lista))
  oyentes.forEach((o) => o())
}

export function suscribirPosiciones(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

const claveDe = (p: Pick<PosicionEnCola, 'hojaDeRutaId' | 'registradaEn'>) => `${p.hojaDeRutaId}|${p.registradaEn}`

/** Guarda las lecturas. La misma hora del mismo viaje queda una sola vez: es la clave con la que el servidor deduplica. */
export function encolarPosiciones(usuarioId: string, nuevas: PosicionEnCola[]): void {
  if (nuevas.length === 0) return
  const porClave = new Map(leerPosiciones(usuarioId).map((p) => [claveDe(p), p]))
  for (const p of nuevas) if (!porClave.has(claveDe(p))) porClave.set(claveDe(p), p)
  escribir(usuarioId, [...porClave.values()].sort(orden))
}

/** Saca las que ya se resolvieron (las de una lectura nueva, llegada mientras tanto, se quedan). */
export function quitarPosiciones(usuarioId: string, resueltas: PosicionEnCola[]): void {
  const claves = new Set(resueltas.map(claveDe))
  escribir(usuarioId, leerPosiciones(usuarioId).filter((p) => !claves.has(claveDe(p))))
}

export function descartarPosicionesDelViaje(usuarioId: string, hojaDeRutaId: string): void {
  escribir(usuarioId, leerPosiciones(usuarioId).filter((p) => p.hojaDeRutaId !== hojaDeRutaId))
}
