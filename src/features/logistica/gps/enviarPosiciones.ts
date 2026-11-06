import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { leerPosiciones, descartarPosicionesDelViaje, quitarPosiciones, type PosicionEnCola } from './colaPosiciones'

/** Tope del contrato por llamada (`POST hojas-ruta/{id}/posiciones`). */
export const MAX_POSICIONES_POR_LOTE = 120
/** El servidor admite 6 llamadas por minuto por usuario: una ronda deja una libre para la lectura siguiente. */
const MAX_LOTES_POR_RONDA = 5

/** `quedan`: se cortó por el tope de la ronda, sigue después; `sinSenal`: falló y se reintenta. */
export type ResultadoEnvioPosiciones = 'vacia' | 'completa' | 'quedan' | 'sinSenal'

/** El viaje no admite más posiciones: reintentar no cambia nada (el contrato manda frenar y descartar). */
const VIAJE_CERRADO = new Set([403, 404, 409])

const sinViaje = ({ hojaDeRutaId: _hoja, ...posicion }: PosicionEnCola) => posicion

let enCurso: Promise<ResultadoEnvioPosiciones> | null = null

/**
 * Manda lo que espera, en lotes, de lo más viejo a lo más nuevo. `alCerrarViaje` se llama cuando el servidor da por
 * cerrado ese viaje (409, 403 o 404). Dos rondas a la vez comparten el envío: un lote nunca sale dos veces en paralelo.
 */
export function enviarPosicionesPendientes(usuarioId: string, alCerrarViaje: (hojaDeRutaId: string) => void): Promise<ResultadoEnvioPosiciones> {
  enCurso ??= ronda(usuarioId, alCerrarViaje).finally(() => { enCurso = null })
  return enCurso
}

async function ronda(usuarioId: string, alCerrarViaje: (hojaDeRutaId: string) => void): Promise<ResultadoEnvioPosiciones> {
  for (let lotes = 0; ; lotes++) {
    // `api` manda el token de quien está en sesión: una cola ajena no se manda.
    if (useAuthStore.getState().user?.id !== usuarioId) return 'sinSenal'
    const pendientes = leerPosiciones(usuarioId)
    if (pendientes.length === 0) return lotes === 0 ? 'vacia' : 'completa'
    if (lotes === MAX_LOTES_POR_RONDA) return 'quedan'
    const { hojaDeRutaId } = pendientes[0]
    const lote = pendientes.filter((p) => p.hojaDeRutaId === hojaDeRutaId).slice(0, MAX_POSICIONES_POR_LOTE)
    try {
      await api.post(`/api/v1/Logistica/hojas-ruta/${hojaDeRutaId}/posiciones`, { posiciones: lote.map(sinViaje) })
      quitarPosiciones(usuarioId, lote)
    } catch (e) {
      const status = (e as { status?: unknown } | null)?.status
      if (typeof status === 'number' && VIAJE_CERRADO.has(status)) {
        descartarPosicionesDelViaje(usuarioId, hojaDeRutaId)
        alCerrarViaje(hojaDeRutaId)
      } else if (status === 400) {
        // Lo validó `aPosicion` y el servidor igual lo rechaza: reenviarlo daría lo mismo y trabaría lo que viene atrás.
        quitarPosiciones(usuarioId, lote)
      } else {
        // Sin red, 5xx, 401 (sale cuando vuelva a entrar) o 429: sigue esperando.
        return 'sinSenal'
      }
    }
  }
}
