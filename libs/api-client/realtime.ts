import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr'
import { logger } from '@/core/utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Forward ERP – SignalR Hub Client
// Eventos en tiempo real: stock-alert, venta-registrada, caja-movimiento
// ─────────────────────────────────────────────────────────────────────────────

export type RealtimeEvent =
  | { type: 'stock-alert'; data: { productoId: string; producto: string; cantidadActual: number } }
  | { type: 'venta-registrada'; data: { ventaId: string; cliente: string; total: number } }
  | { type: 'caja-movimiento'; data: { cajaId: string; tipo: string; monto: number } }
  | { type: 'hoja-ruta-update'; data: { hojaId: string; paradaId: string; estado: string } }

type EventHandler = (event: RealtimeEvent) => void

class RealtimeClient {
  private connection: HubConnection | null = null
  private handlers: Set<EventHandler> = new Set()
  private _getToken: () => string | null = () => null

  configure(options: { getToken: () => string | null; hubUrl: string }) {
    this._getToken = options.getToken

    this.connection = new HubConnectionBuilder()
      .withUrl(options.hubUrl, {
        accessTokenFactory: () => options.getToken() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    // Registrar todos los eventos del hub
    this.connection.on('StockAlert', (data) => {
      this.emit({ type: 'stock-alert', data })
    })

    this.connection.on('VentaRegistrada', (data) => {
      this.emit({ type: 'venta-registrada', data })
    })

    this.connection.on('CajaMovimiento', (data) => {
      this.emit({ type: 'caja-movimiento', data })
    })

    this.connection.on('HojaRutaUpdate', (data) => {
      this.emit({ type: 'hoja-ruta-update', data })
    })

    this.connection.onreconnecting(() => {
      logger.log('[SignalR] Reconnecting...')
    })

    this.connection.onreconnected(() => {
      logger.log('[SignalR] Reconnected')
    })
  }

  async connect() {
    if (!this.connection) return
    if (this.connection.state === HubConnectionState.Connected) return

    try {
      await this.connection.start()
      logger.log('[SignalR] Connected')
    } catch (err) {
      logger.warn('[SignalR] Connection failed (Retrying in 5s):', err)
      // Reintento manual tras 5s
      setTimeout(() => this.connect().catch(() => {}), 5000)
    }
  }

  async disconnect() {
    if (this.connection?.state === HubConnectionState.Connected) {
      await this.connection.stop()
    }
  }

  subscribe(handler: EventHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  private emit(event: RealtimeEvent) {
    this.handlers.forEach((h) => h(event))
  }

  get isConnected() {
    return this.connection?.state === HubConnectionState.Connected
  }
}

// Singleton
export const realtimeClient = new RealtimeClient()

// React hook para suscribirse a eventos
export function useRealtimeEvent(
  eventType: RealtimeEvent['type'],
  handler: (data: RealtimeEvent['data']) => void,
) {
  // Este hook se usa desde web (Next.js) – en mobile se usa directamente el realtimeClient
  throw new Error('Import from @forward/api-client/realtime and use within a React effect')
}
