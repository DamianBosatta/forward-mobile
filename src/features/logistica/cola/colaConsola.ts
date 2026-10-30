import { storage } from '@/core/utils/storage'
import type { CuerpoEntregaParada } from '@/libs/api-client/logistica'

/**
 * Consola del chofer sin señal (lámina chofer-01-viaje--sin-senal): lo que el chofer reporta sin conexión
 * (entrega con su cobro y devolución, o "No pude entregar") queda en el teléfono y sale solo cuando vuelve la señal
 * (`enviarPendientesConsola`). Una cola por usuario en el MMKV cifrado, como la de ventas sin señal: cerrar sesión no la
 * borra y otro usuario del mismo teléfono no la ve ni la manda.
 */

/** Lo que viaja en `POST hojas-ruta/{id}/reportar-parada` cuando no se pudo entregar. */
export interface CuerpoNoEntrega {
  entregado: false
  motivoRechazo?: string
  observaciones?: string
  evidenciaUrl?: string
}

interface Comun {
  /** Identifica la acción en la cola. En una entrega es su `claveIdempotencia` (D2): la misma entrega es siempre la misma clave. */
  clave: string
  hojaDeRutaId: string
  paradaId: string
  clienteNombre: string
}

export type DatosAccion =
  /** `cobrado` y `conDevolucion` solo sirven para decirlo en la lista ("entrega, cobro, devolución"). */
  | (Comun & { tipo: 'entrega'; cuerpo: CuerpoEntregaParada; cobrado: number; conDevolucion: boolean })
  | (Comun & { tipo: 'noEntrega'; cuerpo: CuerpoNoEntrega })

export type EstadoAccion =
  | { tipo: 'esperando'; intentos: number }
  /** El servidor la rechazó: no se reintenta sola; la revisa la oficina o el chofer con este mensaje. */
  | { tipo: 'revisar'; mensaje: string }

export type AccionEnCola = DatosAccion & { encoladaEn: number; estado: EstadoAccion }

const claveDeCola = (usuarioId: string) => `consola-sin-senal:${usuarioId}`
const oyentes = new Set<() => void>()

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Una entrada guardada que se puede mandar sin romper. */
const esAccion = (v: unknown): v is AccionEnCola =>
  esObjeto(v) && typeof v.clave === 'string' && !!v.clave && typeof v.encoladaEn === 'number'
  && typeof v.hojaDeRutaId === 'string' && typeof v.paradaId === 'string'
  && (v.tipo === 'entrega' || v.tipo === 'noEntrega') && esObjeto(v.cuerpo)
  && esObjeto(v.estado) && (v.estado.tipo === 'revisar' || (v.estado.tipo === 'esperando' && typeof v.estado.intentos === 'number'))

/** El texto guardado tal cual (para `useSyncExternalStore`: cambia solo si cambió la cola). */
export function textoDeCola(usuarioId: string | undefined): string | undefined {
  return usuarioId ? storage.getString(claveDeCola(usuarioId)) : undefined
}

export function parsearCola(texto: string | undefined): AccionEnCola[] {
  try {
    const lista: unknown = JSON.parse(texto ?? '[]')
    if (!Array.isArray(lista)) return []
    return lista.filter(esAccion).sort((a, b) => a.encoladaEn - b.encoladaEn)
  } catch {
    return []
  }
}

/** Las acciones del usuario, en el orden en que se hicieron. */
export const leerCola = (usuarioId: string | undefined): AccionEnCola[] => parsearCola(textoDeCola(usuarioId))

function escribir(usuarioId: string, lista: AccionEnCola[]): void {
  storage.set(claveDeCola(usuarioId), JSON.stringify(lista))
  oyentes.forEach((o) => o())
}

/** Avisa cada cambio de cualquier cola. Devuelve cómo dejar de escuchar. */
export function suscribirCola(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

/** Guarda la acción en el teléfono. La misma clave dos veces queda una sola vez (devuelve la que ya estaba). */
export function encolarAccion(usuarioId: string, d: DatosAccion, ahora = Date.now()): AccionEnCola {
  const lista = leerCola(usuarioId)
  const ya = lista.find((a) => a.clave === d.clave)
  if (ya) return ya
  const accion: AccionEnCola = { ...d, encoladaEn: ahora, estado: { tipo: 'esperando', intentos: 0 } }
  escribir(usuarioId, [...lista, accion])
  return accion
}

/** Cambia el estado de una acción (y lo deja guardado antes de seguir). */
export function cambiarEstado(usuarioId: string, clave: string, estado: EstadoAccion): void {
  escribir(usuarioId, leerCola(usuarioId).map((a) => (a.clave === clave ? { ...a, estado } : a)))
}

/** Saca una acción que ya salió (o que el chofer resolvió). */
export function quitarDeCola(usuarioId: string, clave: string): void {
  const lista = leerCola(usuarioId)
  const quedan = lista.filter((a) => a.clave !== clave)
  if (quedan.length !== lista.length) escribir(usuarioId, quedan)
}
