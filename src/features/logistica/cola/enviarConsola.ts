import { api } from '@/core/api/client'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clasificarFalloEntrega } from '../consola/entrega'
import { cambiarEstado, leerCola, quitarDeCola, type AccionEnCola } from './colaConsola'

/** `vacia`: no había nada que mandar; `completa`: se resolvió todo lo que esperaba; `sinSenal`: se cortó y se reintenta después. */
export type ResultadoRonda = 'vacia' | 'completa' | 'sinSenal'

interface Dependencias {
  /** Quién está en sesión ahora: `api` manda el token de ese usuario, así que una cola ajena no se manda. */
  sesion?: () => string | undefined
  /** Salió una acción: hay que volver a pedir la hoja de ruta. */
  alEnviar?: (hojaDeRutaId: string) => void
  /** El servidor rechazó una acción y quedó para revisar. */
  alFallar?: (accion: AccionEnCola) => void
}

const URL_HOJA = (hojaDeRutaId: string) => `/api/v1/Logistica/hojas-ruta/${hojaDeRutaId}`

/**
 * Un fallo que no dice nada de la acción: no llegó (sin red, timeout), el servidor no respondió bien (5xx),
 * la sesión venció (401: sale cuando vuelva a entrar) o demasiados pedidos (429). La acción sigue esperando.
 */
function esTransitoria(e: unknown): boolean {
  if (esFallaDeRed(e)) return true
  const status = (e as { status?: unknown } | null)?.status
  if (typeof status !== 'number') return false
  return status === 401 || status === 408 || status === 429 || status >= 500
}

function mandar(a: AccionEnCola): Promise<unknown> {
  return a.tipo === 'entrega'
    ? api.post(`${URL_HOJA(a.hojaDeRutaId)}/paradas/${a.paradaId}/entregar`, a.cuerpo)
    : api.post(`${URL_HOJA(a.hojaDeRutaId)}/reportar-parada`, { hojaDeRutaId: a.hojaDeRutaId, paradaId: a.paradaId, ...a.cuerpo })
}

let enCurso: Promise<ResultadoRonda> | null = null

/**
 * Manda lo que espera, en orden de llegada (FIFO), una por vez. Si se corta la señal deja el resto como estaba.
 * Un rechazo del servidor no se reintenta: la acción queda "para revisar" y la ronda sigue con la próxima.
 * Dos rondas a la vez comparten el mismo envío: una acción nunca sale dos veces en paralelo.
 */
export function enviarPendientesConsola(usuarioId: string, deps: Dependencias = {}): Promise<ResultadoRonda> {
  enCurso ??= ronda(usuarioId, deps).finally(() => { enCurso = null })
  return enCurso
}

async function ronda(usuarioId: string, deps: Dependencias): Promise<ResultadoRonda> {
  const sesion = deps.sesion ?? (() => useAuthStore.getState().user?.id)
  const esperando = leerCola(usuarioId).filter((a) => a.estado.tipo === 'esperando')
  if (esperando.length === 0) return 'vacia'
  for (const a of esperando) {
    if (sesion() !== usuarioId) return 'sinSenal'
    try {
      await mandar(a)
    } catch (e) {
      if (esTransitoria(e)) {
        const intentos = a.estado.tipo === 'esperando' ? a.estado.intentos + 1 : 1
        cambiarEstado(usuarioId, a.clave, { tipo: 'esperando', intentos })
        return 'sinSenal'
      }
      // Ya estaba registrada (un intento anterior llegó, quizás sin que se viera la respuesta): cuenta como enviada.
      // Un aviso con clave que el servidor ya tiene con otro cuerpo no es "enviado": se muestra para revisar.
      const otroCuerpo = a.tipo === 'noEntrega' && (e as { codigo?: string }).codigo === 'ClaveIdempotenciaConOtroCuerpo'
      if (!otroCuerpo && clasificarFalloEntrega(e).tipo === 'yaRegistrada') {
        quitarDeCola(usuarioId, a.clave)
        deps.alEnviar?.(a.hojaDeRutaId)
        continue
      }
      cambiarEstado(usuarioId, a.clave, { tipo: 'revisar', mensaje: mensajeDelServidor(e, 'El servidor rechazó el reporte.') })
      deps.alFallar?.(a)
      continue
    }
    quitarDeCola(usuarioId, a.clave)
    deps.alEnviar?.(a.hojaDeRutaId)
  }
  return 'completa'
}
