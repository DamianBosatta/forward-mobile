import { storage } from '@/core/utils/storage'
import { diaArgentina } from '@/src/utils/date'
import { errorDeAltaVenta, nuevaClaveIdempotencia, type AltaVenta } from '@/features/venta-nueva/lib/payload'
import { precioServidor, type LineaCarrito } from '@/features/venta-nueva/lib/carrito'
import { totalesEstimados } from '@/features/venta-nueva/lib/avisos'
import type { ClienteNombrable } from '@/features/clientes/lib/cliente'
import type { EstadoVentaNombre } from '@/core/constants/estados'

/**
 * Vender sin señal (V9, D4): las ventas que no se pudieron mandar quedan en el teléfono y se mandan
 * solas cuando vuelve la señal (`enviarPendientes`). Solo la app (D1): el cuerpo es el de `POST /Ventas`
 * con su `claveIdempotencia`, generada UNA vez al encolar, así un reintento nunca graba otra venta.
 *
 * Se guarda en el MMKV de la app (`core/utils/storage`, cifrado), una cola por usuario como los
 * clientes recientes: cerrar sesión no la borra y otro usuario del mismo teléfono no la ve ni la manda.
 */

/** En qué paso del envío quedó la venta. Se guarda ANTES de cada llamada: si la app muere, se retoma de ahí. */
export type FaseEnvio =
  /** Todavía no se mandó nada: primero la vista previa, para comparar el precio. */
  | { paso: 'nueva' }
  /** Se intentó el alta al menos una vez: pudo haberse grabado, así que solo se reintenta el alta con la misma clave. */
  | { paso: 'altaEnviada' }
  /**
   * El precio cambió y se pidió el borrador en `desde` (ms): si no hubo respuesta, se busca antes de
   * crear otro. `totalServidor`: el total con el precio de hoy, según la vista previa.
   */
  | { paso: 'creandoBorrador'; desde: number; totalServidor: number | null }
  /** El borrador existe; falta cargarle las líneas. */
  | { paso: 'borradorCreado'; ventaId: string; version: number; totalServidor: number | null }

export type EstadoEnCola =
  | { tipo: 'esperando'; fase: FaseEnvio; intentos: number }
  | { tipo: 'enviada'; ventaId: string; codigo: string | null; estado: EstadoVentaNombre | null }
  /** El precio cambió al enviarse: quedó como borrador para revisarla (no se confirmó). */
  | { tipo: 'enBorradores'; ventaId: string; totalServidor: number | null }
  /** El servidor la rechazó: no se reintenta sola; el vendedor la revisa con este mensaje. */
  | { tipo: 'revisar'; mensaje: string }

/** Lo que el vendedor vio al vender: el total y el precio de cada producto (el del servidor, de la hora del catálogo). */
export interface LoQueVio {
  total: number
  /** productoId → precio unitario sobre el que se aplican los descuentos (`precioServidor`). */
  precios: Record<string, number>
}

/** Lo que el vendedor tenía en pantalla: el precio del servidor de cada línea y el total estimado (con descuento y flete). */
export function loQueVio(lineas: LineaCarrito[], descuentoGeneral: number, flete = 0): LoQueVio {
  return {
    precios: Object.fromEntries(lineas.map((l) => [l.productoId, precioServidor(l.producto)])),
    total: totalesEstimados(lineas, descuentoGeneral, flete).total,
  }
}

export interface VentaEnCola {
  /** = `alta.claveIdempotencia`; identifica la venta en la cola. */
  clave: string
  alta: AltaVenta
  encoladaEn: number
  cliente: ClienteNombrable
  visto: LoQueVio
  estado: EstadoEnCola
}

export interface DatosParaEncolar {
  /** Si trae `claveIdempotencia` (un intento de alta que quedó sin respuesta) se conserva; si no, se genera. */
  alta: AltaVenta
  cliente: ClienteNombrable
  visto: LoQueVio
  /** El alta ya se intentó con esa clave: pudo haberse grabado, así que no pasa por la vista previa ni por Borradores. */
  yaSeIntento?: boolean
}

const claveDeCola = (usuarioId: string) => `ventas-sin-senal:${usuarioId}`
const oyentes = new Set<() => void>()

const esVentaEnCola = (v: unknown): v is VentaEnCola =>
  typeof (v as VentaEnCola)?.clave === 'string' && typeof (v as VentaEnCola)?.estado?.tipo === 'string' && !!(v as VentaEnCola).alta

/** El texto guardado tal cual (para `useSyncExternalStore`: cambia solo si cambió la cola). */
export function textoDeCola(usuarioId: string | undefined): string | undefined {
  return usuarioId ? storage.getString(claveDeCola(usuarioId)) : undefined
}

export function parsearCola(texto: string | undefined): VentaEnCola[] {
  try {
    const lista: unknown = JSON.parse(texto ?? '[]')
    if (!Array.isArray(lista)) return []
    return lista.filter(esVentaEnCola).sort((a, b) => a.encoladaEn - b.encoladaEn)
  } catch {
    return []
  }
}

/** Las ventas del usuario, en el orden en que se encolaron. */
export function leerCola(usuarioId: string | undefined): VentaEnCola[] {
  return parsearCola(textoDeCola(usuarioId))
}

function escribir(usuarioId: string, lista: VentaEnCola[]): void {
  storage.set(claveDeCola(usuarioId), JSON.stringify(lista))
  oyentes.forEach((o) => o())
}

/** Avisa cada cambio de cualquier cola. Devuelve cómo dejar de escuchar. */
export function suscribirCola(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

/**
 * Guarda la venta en el teléfono. La misma clave dos veces queda una sola vez (devuelve la que ya estaba).
 * Antes corre el esquema del contrato (X5, `errorDeAltaVenta`): una venta que el servidor rechazaría
 * por forma no se guarda; tira un Error con el mensaje para mostrarlo en la venta.
 */
export function encolarVenta(usuarioId: string, d: DatosParaEncolar, ahora = Date.now()): VentaEnCola {
  const lista = leerCola(usuarioId)
  const clave = d.alta.claveIdempotencia?.trim() || nuevaClaveIdempotencia()
  const ya = lista.find((v) => v.clave === clave)
  if (ya) return ya
  const invalido = errorDeAltaVenta({ ...d.alta, claveIdempotencia: clave })
  if (invalido) throw new Error(invalido)
  const venta: VentaEnCola = {
    clave,
    alta: { ...d.alta, claveIdempotencia: clave },
    encoladaEn: ahora,
    cliente: d.cliente,
    visto: d.visto,
    estado: { tipo: 'esperando', fase: { paso: d.yaSeIntento ? 'altaEnviada' : 'nueva' }, intentos: 0 },
  }
  escribir(usuarioId, [...lista, venta])
  return venta
}

/** Cambia el estado de una venta (y lo deja guardado antes de seguir). */
export function cambiarEstado(usuarioId: string, clave: string, estado: EstadoEnCola): void {
  escribir(usuarioId, leerCola(usuarioId).map((v) => (v.clave === clave ? { ...v, estado } : v)))
}

/** Saca una venta que el vendedor ya revisó (para revisar o en Borradores). Las que esperan no se sacan acá. */
export function quitarDeCola(usuarioId: string, clave: string): void {
  escribir(usuarioId, leerCola(usuarioId).filter((v) => v.clave !== clave || v.estado.tipo === 'esperando'))
}

/** "Mis ventas de hoy": las enviadas y las que quedaron en Borradores de otro día argentino se borran. */
export function limpiarEnviadasViejas(usuarioId: string, ahora = Date.now()): void {
  const hoy = diaArgentina(ahora)
  const lista = leerCola(usuarioId)
  const quedan = lista.filter((v) => (v.estado.tipo !== 'enviada' && v.estado.tipo !== 'enBorradores') || diaArgentina(v.encoladaEn) === hoy)
  if (quedan.length !== lista.length) escribir(usuarioId, quedan)
}
