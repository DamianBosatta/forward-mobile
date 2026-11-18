import { api } from '@/core/api/client'
import { esFallaDeRed, esTiempoAgotado } from '@/core/api/errores'
import { TOPE_DE_INTENTOS, avisoDeTope } from '@/core/utils/colasSinSenal'
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
  if (esFallaDeRed(e) || esTiempoAgotado(e)) return true
  const status = (e as { status?: unknown } | null)?.status
  if (typeof status !== 'number') return false
  return status === 401 || status === 408 || status === 429 || status >= 500
}

/**
 * Hora en que el chofer resolvió la parada: la del celular al encolar (S6). Una acción guardada con una hora que no
 * se puede escribir como fecha se manda sin ella y el servidor usa la suya. No toca el formato guardado de la cola.
 */
function resueltaEnDe(a: AccionEnCola): { resueltaEn?: string } {
  const fecha = new Date(a.encoladaEn)
  return Number.isNaN(fecha.getTime()) ? {} : { resueltaEn: fecha.toISOString() }
}

function mandar(a: AccionEnCola): Promise<unknown> {
  const resuelta = resueltaEnDe(a)
  const hoja = URL_HOJA(a.hojaDeRutaId)
  switch (a.tipo) {
    case 'entrega': return api.post(`${hoja}/paradas/${a.paradaId}/entregar`, { ...a.cuerpo, ...resuelta })
    case 'cobroParada': return api.post(`${hoja}/paradas-cobro/${a.paradaId}/cobrar`, { ...a.cuerpo, ...resuelta })
    case 'noCobroParada': return api.post(`${hoja}/paradas-cobro/${a.paradaId}/no-cobrada`, { ...a.cuerpo, ...resuelta })
    default: return api.post(`${hoja}/reportar-parada`, { hojaDeRutaId: a.hojaDeRutaId, paradaId: a.paradaId, ...a.cuerpo, ...resuelta })
  }
}

let enCurso: Promise<ResultadoRonda> | null = null

/**
 * Manda lo que espera, en orden de llegada (FIFO), una por vez. Si se corta la señal deja el resto como estaba.
 * Un rechazo del servidor no se reintenta: la acción queda "para revisar" y la ronda sigue con la próxima. Lo mismo
 * pasa al fallo de red número `TOPE_DE_INTENTOS` de una misma acción: deja de trabar a las de atrás.
 * Dos rondas a la vez comparten el mismo envío: una acción nunca sale dos veces en paralelo.
 */
export function enviarPendientesConsola(usuarioId: string, deps: Dependencias = {}): Promise<ResultadoRonda> {
  enCurso ??= ronda(usuarioId, deps).finally(() => { enCurso = null })
  return enCurso
}

async function ronda(usuarioId: string, deps: Dependencias): Promise<ResultadoRonda> {
  const sesion = deps.sesion ?? (() => useAuthStore.getState().user?.id)
  const vistas = new Set<string>()
  // Se relee la cola en cada vuelta: lo que se encola (o se reintenta) durante la ronda también sale, en orden.
  for (;;) {
    const a = leerCola(usuarioId).find((x) => x.estado.tipo === 'esperando' && !vistas.has(x.clave))
    if (!a) return vistas.size ? 'completa' : 'vacia'
    if (sesion() !== usuarioId) return 'sinSenal'
    vistas.add(a.clave)
    try {
      await mandar(a)
    } catch (e) {
      if (esTransitoria(e)) {
        const intentos = a.estado.tipo === 'esperando' ? a.estado.intentos + 1 : 1
        if (intentos < TOPE_DE_INTENTOS) {
          cambiarEstado(usuarioId, a.clave, { tipo: 'esperando', intentos })
          return 'sinSenal'
        }
        // Tope: deja de reintentarse sola para no trabar la cola; el chofer la reintenta o la descarta.
        cambiarEstado(usuarioId, a.clave, {
          tipo: 'revisar', mensaje: avisoDeTope('Tocá Reintentar para mandarla de nuevo o Descartar para sacarla del teléfono.'),
        })
        deps.alFallar?.(a)
        continue
      }
      // Ya estaba registrada (un intento anterior llegó, quizás sin que se viera la respuesta): cuenta como enviada.
      // Un aviso con clave que el servidor ya tiene con otro cuerpo no es "enviado": se muestra para revisar.
      // Una parada de solo cobro nunca se da por enviada por un 409: el cobro no se pierde, queda para revisar.
      const esDeCobro = a.tipo === 'cobroParada' || a.tipo === 'noCobroParada'
      const otroCuerpo = esDeCobro || a.tipo === 'noEntrega' && (e as { codigo?: string }).codigo === 'ClaveIdempotenciaConOtroCuerpo'
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
}
