import { AppState } from 'react-native'
import { HttpTransportType, HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import { API_URL, tokenActual } from '@/core/api/client'
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

export interface OyenteStock {
  /** La conexión (re)quedó lista y unida a los depósitos: hay que refrescar lo que se muestra. */
  alConectar: () => void
  alCambio: (mensaje: MensajeStock) => void
  /** true: llegan avisos; false: sin conexión. */
  alEstado: (enVivo: boolean) => void
}

const EVENTO = 'StockCambio'

function conexionReal(): ConexionStock {
  return new HubConnectionBuilder()
    // El token viaja en `accessTokenFactory` (query string solo en este hub), no en cookies.
    .withUrl(`${API_URL}/hubs/stock`, { accessTokenFactory: () => tokenActual() ?? '', withCredentials: false })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.None)
    .build()
}

export function crearGestorStock(crear: () => ConexionStock = conexionReal) {
  const oyentes = new Map<OyenteStock, string[]>()
  let conexion: ConexionStock | null = null
  let conectando = false
  let enVivo = false
  // Si el servidor mandó que este usuario recibe cantidades en al menos un depósito (sin ellas, solo el estado).
  let cantidades = false
  // Cada apertura/cierre invalida las rondas anteriores que siguen en vuelo.
  let ronda = 0

  const depositos = () => [...new Set([...oyentes.values()].flat())]
  const poner = (valor: boolean) => {
    if (enVivo === valor) return
    enVivo = valor
    oyentes.forEach((_, o) => o.alEstado(valor))
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
    oyentes.forEach((_, o) => o.alConectar())
  }

  async function abrir() {
    if (conexion || conectando || oyentes.size === 0 || AppState.currentState !== 'active') return
    conectando = true
    const mia = ++ronda
    const c = crear()
    c.on(EVENTO, (m: MensajeStock) => { if (mia === ronda) oyentes.forEach((_, o) => o.alCambio(m)) })
    c.onreconnecting(() => { if (mia === ronda) { cantidades = false; poner(false) } })
    c.onreconnected(() => { if (mia === ronda) void conectado(c, mia) })
    c.onclose(() => { if (mia === ronda) { conexion = null; poner(false) } })
    try {
      await c.start()
      if (mia !== ronda) { void c.stop(); return }
      conexion = c
      await conectado(c, mia)
    } catch (e) {
      logger.warn('No se pudo abrir el stock en vivo', e)
      if (mia === ronda) poner(false)
    } finally {
      conectando = false
    }
  }

  function soltar() {
    ronda++
    const c = conexion
    conexion = null
    conectando = false
    poner(false)
    cantidades = false
    if (c) void c.stop().catch(() => undefined)
  }

  let sub: { remove: () => void } | null = null
  const alCambiarAppState = (e: string) => {
    if (e === 'active') void abrir()
    else if (e === 'background') soltar()
  }

  return {
    /** Se une a `depositoIds`; abre la conexión si es el primero. Devuelve la baja. */
    suscribir(depositoIds: string[], oyente: OyenteStock): () => void {
      oyentes.set(oyente, depositoIds)
      if (!sub) sub = AppState.addEventListener('change', alCambiarAppState)
      if (conexion && enVivo) void unirse(conexion, depositoIds)
      else void abrir()
      return () => {
        oyentes.delete(oyente)
        if (oyentes.size > 0) return
        sub?.remove()
        sub = null
        soltar()
      }
    },
    /** Reintenta abrir si no hay conexión (la reconexión automática no cubre una apertura fallida). */
    reintentar: () => { void abrir() },
    enVivo: () => enVivo,
    /** Los avisos traen cantidades (el usuario tiene `CAP_VER_CANTIDADES_STOCK`); si no, solo el estado. */
    veCantidades: () => cantidades,
  }
}

export type GestorStock = ReturnType<typeof crearGestorStock>

/** El de la app. */
export const gestorStock: GestorStock = crearGestorStock()
