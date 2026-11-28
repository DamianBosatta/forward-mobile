import { AppState } from 'react-native'
import { HttpTransportType, HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import { API_URL, alRenovarToken, tokenFresco } from '@/core/api/client'
import { logger } from '@/core/utils/logger'

/**
 * Stock en vivo (F4): la conexión SignalR a `/hubs/stock` (contrato "Stock en tiempo real (F2)").
 * Una sola conexión por app, compartida por quienes la usan. La app la suelta en segundo plano (batería) y la
 * vuelve a abrir al volver; en cada (re)conexión se une de nuevo a los depósitos (el servidor no se acuerda)
 * y avisa para refrescar, porque lo que cambió mientras estaba cortada no se notifica.
 */

export type EstadoStock = 'SinStock' | 'EnAlerta' | 'ConStock'

/** Una variante que cambió. Sin `disponible`/`stockMinimo`: el usuario no ve cantidades, solo el estado. */
export interface CambioProducto {
  productoId: string
  estado: EstadoStock
  disponible?: number
  stockMinimo?: number
}

export interface MensajeStock {
  depositoId: string
  productos: CambioProducto[]
}

/** Lo que se usa de `HubConnection` (así un test puede darle una de mentira). */
export type ConexionStock = Pick<HubConnection, 'start' | 'stop' | 'invoke' | 'on' | 'onreconnecting' | 'onreconnected' | 'onclose'>

/** Cómo está la conexión para quien la muestra: intentando (primer intento o reconexión automática), lista o cortada. */
export type ConexionStockVivo = 'conectando' | 'enVivo' | 'sinConexion'

/** Para quien solo tiene el booleano `enVivo` (sin dato no hay estado): true es "enVivo", false "sinConexion". */
export function conexionDeBooleano(enVivo: boolean | undefined): ConexionStockVivo | undefined {
  return enVivo === undefined ? undefined : enVivo ? 'enVivo' : 'sinConexion'
}

export interface OyenteStock {
  /** La conexión (re)quedó lista y unida a los depósitos: hay que refrescar lo que se muestra. */
  alConectar: () => void
  alCambio: (mensaje: MensajeStock) => void
  /** true: llegan avisos; false: sin conexión. */
  alEstado: (enVivo: boolean) => void
  /** Cómo está la conexión (se avisa también al suscribirse, con el estado actual). */
  alConexion?: (conexion: ConexionStockVivo) => void
}

/** Avisos de cambios de datos (`[{ tipo, id }]`, lote cada ~300 ms) para refrescar lo que ya está en pantalla. */
export interface OyenteAvisos {
  alAvisos: (avisos: unknown) => void
  /** Se volvió a conectar (reconexión o vuelta de segundo plano): pudo perderse algún aviso. No suena en la primera conexión. */
  alReconectar: () => void
}

const EVENTO = 'StockCambio'
const EVENTO_ENTIDADES = 'EntidadCambio'
const ESPERA_INICIAL_MS = 2_000
const ESPERA_MAXIMA_MS = 30_000
const ESPERAS_RECONEXION_MS = [0, 2_000, 5_000, 10_000, 30_000]

/** Reconexión automática de SignalR que no se rinde nunca (la de fábrica corta a los ~42 s): 0, 2, 5, 10 y 30 s, y de ahí cada 30 s. */
export const politicaReintento = {
  nextRetryDelayInMilliseconds: (ctx: { previousRetryCount: number }): number =>
    ESPERAS_RECONEXION_MS[Math.min(ctx.previousRetryCount, ESPERAS_RECONEXION_MS.length - 1)],
}

/** Un 4xx que no se arregla esperando (403 sin permiso del hub, 404...): 401 (se renueva el token), 408 y 429 sí se reintentan. */
function esRechazoPermanente(e: unknown): boolean {
  const codigo = (e as { statusCode?: unknown } | null)?.statusCode
  return typeof codigo === 'number' && codigo >= 400 && codigo < 500 && ![401, 408, 429].includes(codigo)
}

export function conexionReal(): ConexionStock {
  return new HubConnectionBuilder()
    // El token viaja en `accessTokenFactory` (query string solo en este hub), no en cookies. Al reconectar tras vencer el JWT el servidor corta y renegocia: `tokenFresco` lo renueva antes.
    .withUrl(`${API_URL}/hubs/stock`, { accessTokenFactory: () => tokenFresco(), withCredentials: false })
    .withAutomaticReconnect(politicaReintento)
    .configureLogging(LogLevel.None)
    .build()
}

export function crearGestorStock(
  crear: () => ConexionStock = conexionReal,
  /** Cómo enterarse de un token renovado (el de la app escucha al cliente HTTP). */
  alRenovar: (oyente: () => void) => () => void = alRenovarToken,
) {
  const oyentes = new Map<OyenteStock, string[]>()
  const oyentesAvisos = new Set<OyenteAvisos>()
  // Ya hubo una conexión lista: las siguientes son reconexiones y piden refrescar.
  let yaConecto = false
  let conexion: ConexionStock | null = null
  let conectando = false
  let enVivo = false
  // Lo que se muestra. "Sin conexión" solo tras un intento fallido o un cierre, y ahí se queda durante los reintentos silenciosos.
  let situacion: ConexionStockVivo = 'conectando'
  // Si el servidor mandó que este usuario recibe cantidades en al menos un depósito (sin ellas, solo el estado).
  let cantidades = false
  // Cada apertura/cierre invalida las rondas anteriores que siguen en vuelo.
  let ronda = 0
  // Apertura fallida por red, 5xx o 401: reintento con espera creciente mientras haya quien escuche (un 4xx permanente, como un
  // 403, no reintenta). Tras un 401 además reabre la renovación del token (alRenovarToken).
  let intentos = 0
  let temporizador: ReturnType<typeof setTimeout> | null = null
  const cancelarReintento = () => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = null
  }
  const reintentarLuego = () => {
    if (temporizador || (oyentes.size === 0 && oyentesAvisos.size === 0)) return
    const espera = Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** intentos)
    intentos++
    temporizador = setTimeout(() => { temporizador = null; void abrir() }, espera)
  }

  const depositos = () => [...new Set([...oyentes.values()].flat())]
  const poner = (valor: boolean) => {
    if (enVivo === valor) return
    enVivo = valor
    oyentes.forEach((_, o) => o.alEstado(valor))
  }

  const ponerConexion = (valor: ConexionStockVivo) => {
    if (situacion === valor) return
    situacion = valor
    oyentes.forEach((_, o) => o.alConexion?.(valor))
  }

  async function unirse(c: ConexionStock, ids: string[]) {
    // Un depósito sin acceso tira error: no tumba a los demás.
    const r = await Promise.all(ids.map((id) => c.invoke('UnirseAlDeposito', id).catch((e) => { logger.warn('No se pudo unir al depósito de stock', e); return false })))
    cantidades = cantidades || r.some((v) => v === true)
  }

  async function conectado(c: ConexionStock, mia: number) {
    await unirse(c, depositos())
    if (mia !== ronda) return
    poner(true)
    ponerConexion('enVivo')
    oyentes.forEach((_, o) => o.alConectar())
    if (yaConecto) oyentesAvisos.forEach((o) => o.alReconectar())
    yaConecto = true
  }

  async function abrir() {
    if (conexion || conectando || (oyentes.size === 0 && oyentesAvisos.size === 0) || AppState.currentState !== 'active') return
    cancelarReintento()
    conectando = true
    // Un reintento silencioso desde "sin conexión" no cambia lo que se ve.
    if (situacion !== 'sinConexion') ponerConexion('conectando')
    const mia = ++ronda
    const c = crear()
    c.on(EVENTO, (m: MensajeStock) => { if (mia === ronda) oyentes.forEach((_, o) => o.alCambio(m)) })
    c.on(EVENTO_ENTIDADES, (avisos: unknown) => { if (mia === ronda) oyentesAvisos.forEach((o) => o.alAvisos(avisos)) })
    c.onreconnecting(() => { if (mia === ronda) { cantidades = false; poner(false); ponerConexion('conectando') } })
    c.onreconnected(() => { if (mia === ronda) void conectado(c, mia) })
    // Si la reconexión automática se rindió, se reabre con la misma espera creciente que una apertura fallida (soltar() la cancela).
    c.onclose(() => { if (mia === ronda) { conexion = null; poner(false); ponerConexion('sinConexion'); reintentarLuego() } })
    try {
      await c.start()
      if (mia !== ronda) { void c.stop(); return }
      conexion = c
      intentos = 0
      await conectado(c, mia)
    } catch (e) {
      logger.warn('No se pudo abrir el stock en vivo', e)
      if (mia === ronda) { poner(false); ponerConexion('sinConexion'); if (!esRechazoPermanente(e)) reintentarLuego() }
    } finally {
      conectando = false
    }
  }

  function soltar() {
    cancelarReintento()
    intentos = 0
    ronda++
    const c = conexion
    conexion = null
    conectando = false
    poner(false)
    // Suelta por segundo plano o sin oyentes: al volver es un intento nuevo.
    ponerConexion('conectando')
    cantidades = false
    if (c) void c.stop().catch(() => undefined)
  }

  let sub: { remove: () => void } | null = null
  // Una apertura fallida por 401 (token vencido al abrir la app) no la cubre la reconexión automática:
  // al renovarse el token se reintenta una vez. `abrir` no hace nada si ya hay conexión o una apertura en curso.
  let bajaRenovacion: (() => void) | null = null
  const alCambiarAppState = (e: string) => {
    if (e === 'active') void abrir()
    else if (e === 'background') soltar()
  }
  const escucharAppState = () => {
    if (!sub) sub = AppState.addEventListener('change', alCambiarAppState)
    if (!bajaRenovacion) bajaRenovacion = alRenovar(() => { void abrir() })
  }
  /** Sin nadie que escuche (stock ni avisos) se suelta la conexión y se olvida que hubo una. */
  const soltarSiNadie = () => {
    if (oyentes.size > 0 || oyentesAvisos.size > 0) return
    sub?.remove()
    sub = null
    bajaRenovacion?.()
    bajaRenovacion = null
    yaConecto = false
    soltar()
  }

  return {
    /** Se une a `depositoIds`; abre la conexión si es el primero. Devuelve la baja. */
    suscribir(depositoIds: string[], oyente: OyenteStock): () => void {
      oyentes.set(oyente, depositoIds)
      oyente.alConexion?.(situacion)
      escucharAppState()
      if (conexion && enVivo) void unirse(conexion, depositoIds)
      else void abrir()
      return () => {
        oyentes.delete(oyente)
        soltarSiNadie()
      }
    },
    /** Escucha los avisos de cambios (`EntidadCambio`) por la misma conexión; la abre si es el primero. Devuelve la baja. */
    suscribirAvisos(oyente: OyenteAvisos): () => void {
      oyentesAvisos.add(oyente)
      escucharAppState()
      void abrir()
      return () => {
        oyentesAvisos.delete(oyente)
        soltarSiNadie()
      }
    },
    /** Reintenta abrir si no hay conexión (la reconexión automática no cubre una apertura fallida). */
    reintentar: () => { void abrir() },
    enVivo: () => enVivo,
    /** Estado de la conexión para mostrar: conectando, en vivo o sin conexión. */
    conexion: () => situacion,
    /** Los avisos traen cantidades (el usuario tiene `CAP_VER_CANTIDADES_STOCK`); si no, solo el estado. */
    veCantidades: () => cantidades,
  }
}

export type GestorStock = ReturnType<typeof crearGestorStock>

/** El de la app. */
export const gestorStock: GestorStock = crearGestorStock()
