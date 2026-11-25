import { storage } from '@/core/utils/storage'
import { logger } from '@/core/utils/logger'
import { diaArgentina } from '@/core/utils/fecha'
import { redondear2 } from '@/libs/reglas/dinero'
import { errorDeAltaVenta, type AltaVenta } from '@/features/venta-nueva/lib/payload'
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
  /**
   * `intentos`: todos los fallos transitorios. `fallosDelTope`: solo los que cuentan para `TOPE_DE_INTENTOS`
   * (`fallosDelTopeTras`); falta en las colas guardadas por la versión anterior y vale cero.
   */
  | { tipo: 'esperando'; fase: FaseEnvio; intentos: number; fallosDelTope?: number }
  /** `total`: solo en una venta con factura (el neto que vio el vendedor no es lo que se grabó): el total con IVA que dijo el servidor al enviarla. */
  | { tipo: 'enviada'; ventaId: string; codigo: string | null; estado: EstadoVentaNombre | null; total?: number }
  /** El precio cambió al enviarse: quedó como borrador para revisarla (no se confirmó). */
  | { tipo: 'enBorradores'; ventaId: string; totalServidor: number | null }
  /**
   * El servidor la rechazó, o se detuvo por el tope de intentos (`TOPE_DE_INTENTOS`): no se reintenta sola; el vendedor
   * la revisa con este mensaje. `fase`: solo la detenida por el tope, el paso donde quedó (pudo haberse grabado), para
   * retomarla desde ahí con la misma clave (`reintentarVenta`).
   */
  | { tipo: 'revisar'; mensaje: string; fase?: FaseEnvio }

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

/**
 * El total que vio el vendedor en pantalla (con descuento y flete), el que va como `totalEsperado` cuando el servidor no
 * le mostró uno: nada se graba a un total que el vendedor no vio. Una sola cuenta para la pantalla y la cola (X1).
 */
export const totalVisto = (visto: LoQueVio): number => redondear2(visto.total)

export interface VentaEnCola {
  /** = `alta.claveIdempotencia`; identifica la venta en la cola. */
  clave: string
  /** El cuerpo exacto del POST /Ventas, con su `totalEsperado`. */
  alta: AltaVenta
  encoladaEn: number
  cliente: ClienteNombrable
  visto: LoQueVio
  estado: EstadoEnCola
}

/**
 * Con el tilde de factura el total lo arma el servidor con el IVA encima del neto: un `totalEsperado` que es el neto da 409
 * `TotalCambiado` (la venta no se graba), y se cotiza de nuevo antes de mandarla con el total del servidor.
 */
export const llevaIva = (alta: { conFactura?: boolean | null }): boolean => alta.conFactura === true

export interface DatosParaEncolar {
  /**
   * Con su `claveIdempotencia` (obligatoria): la misma venta es siempre la misma clave, y encolarla dos veces no la duplica.
   * Si ya se intentó (`yaSeIntento`) es el cuerpo que se mandó, con su `totalEsperado`.
   */
  alta: AltaVenta
  cliente: ClienteNombrable
  visto: LoQueVio
  /** El alta ya se intentó con esa clave: pudo haberse grabado, así que no pasa por la vista previa ni por Borradores. */
  yaSeIntento?: boolean
}

const claveDeCola = (usuarioId: string) => `ventas-sin-senal:${usuarioId}`
const oyentes = new Set<() => void>()

const PASOS: ReadonlySet<string> = new Set(['nueva', 'altaEnviada', 'creandoBorrador', 'borradorCreado'])
const TIPOS: ReadonlySet<string> = new Set(['esperando', 'enviada', 'enBorradores', 'revisar'])
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Una entrada guardada que se puede mandar sin romper: con clave, cuerpo, y un estado que el envío sabe leer. */
const esVentaEnCola = (v: unknown): v is VentaEnCola => {
  if (!esObjeto(v) || typeof v.clave !== 'string' || !v.clave || typeof v.encoladaEn !== 'number') return false
  if (!esObjeto(v.alta) || !esObjeto(v.cliente) || !esObjeto(v.visto) || !esObjeto(v.estado)) return false
  if (typeof v.estado.tipo !== 'string' || !TIPOS.has(v.estado.tipo)) return false
  if (v.estado.tipo !== 'esperando') return true
  return typeof v.estado.intentos === 'number' && esObjeto(v.estado.fase) && PASOS.has(v.estado.fase.paso as string)
}

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

const claveDeRotas = (usuarioId: string) => `${claveDeCola(usuarioId)}:rotas`

/**
 * Antes de pisar la cola, lo que no se puede leer (texto roto o entradas inválidas) se guarda aparte y se avisa:
 * la cola sigue andando con lo válido y lo roto queda para revisarlo, en vez de perderse en silencio.
 */
function respaldarLoRoto(usuarioId: string): void {
  const texto = textoDeCola(usuarioId)
  if (texto === undefined) return
  let rotas: unknown[]
  try {
    const lista: unknown = JSON.parse(texto)
    rotas = Array.isArray(lista) ? lista.filter((v) => !esVentaEnCola(v)) : [texto]
  } catch {
    rotas = [texto]
  }
  if (rotas.length === 0) return
  let previas: unknown[] = []
  try {
    const p: unknown = JSON.parse(storage.getString(claveDeRotas(usuarioId)) ?? '[]')
    if (Array.isArray(p)) previas = p
  } catch { /* el respaldo anterior también estaba roto: se reemplaza */ }
  storage.set(claveDeRotas(usuarioId), JSON.stringify([...previas, ...rotas]))
  logger.warn('Cola de ventas sin señal: se respaldaron entradas ilegibles', { cantidad: rotas.length })
}

function escribir(usuarioId: string, lista: VentaEnCola[]): void {
  respaldarLoRoto(usuarioId)
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
  const clave = d.alta.claveIdempotencia?.trim()
  if (!clave) throw new Error('La venta no tiene clave de idempotencia: sin ella un reintento podría grabarla dos veces.')
  const ya = lista.find((v) => v.clave === clave)
  if (ya) return ya
  const { totalEsperado: yaMandado, ...sinTotal } = d.alta
  const invalido = errorDeAltaVenta({ ...sinTotal, claveIdempotencia: clave })
  if (invalido) throw new Error(invalido)
  // El cuerpo en la cola es exactamente el que se mandó (o se va a mandar): con el total que vio la pantalla, y si no mandó
  // ninguno, el que vio el vendedor. Con factura ese neto da 409 TotalCambiado y se cotiza de nuevo (`enviar.ts`).
  const alta: AltaVenta = { ...d.alta, claveIdempotencia: clave, totalEsperado: yaMandado ?? totalVisto(d.visto) }
  const venta: VentaEnCola = {
    clave,
    alta,
    encoladaEn: ahora,
    cliente: d.cliente,
    visto: d.visto,
    estado: { tipo: 'esperando', fase: { paso: d.yaSeIntento ? 'altaEnviada' : 'nueva' }, intentos: 0 },
  }
  escribir(usuarioId, [...lista, venta])
  return venta
}

/**
 * Cambia el estado de una venta (y lo deja guardado antes de seguir). `totalEsperado`: el total con IVA de una venta con factura,
 * que se guarda en el mismo paso que el cambio de fase, antes del POST que lo manda.
 */
export function cambiarEstado(usuarioId: string, clave: string, estado: EstadoEnCola, totalEsperado?: number): void {
  escribir(usuarioId, leerCola(usuarioId).map((v) => {
    if (v.clave !== clave) return v
    return totalEsperado === undefined ? { ...v, estado } : { ...v, estado, alta: { ...v.alta, totalEsperado } }
  }))
}

/** La venta se detuvo por el tope de intentos (no la rechazó el servidor) y se puede retomar. */
export const detenidaPorTope = (v: VentaEnCola): boolean =>
  v.estado.tipo === 'revisar' && esObjeto(v.estado.fase) && PASOS.has(v.estado.fase.paso as string)

/**
 * Retoma una venta detenida por el tope: vuelve a esperar desde el paso donde quedó, con la misma clave y desde cero
 * intentos. Una que rechazó el servidor (sin fase) no cambia: reintentarla daría el mismo rechazo.
 */
export function reintentarVenta(usuarioId: string, clave: string): void {
  const v = leerCola(usuarioId).find((x) => x.clave === clave)
  if (!v || !detenidaPorTope(v) || v.estado.tipo !== 'revisar' || !v.estado.fase) return
  cambiarEstado(usuarioId, clave, { tipo: 'esperando', fase: v.estado.fase, intentos: 0 })
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

/**
 * Las que quedaron en Borradores y ya no están (el vendedor las confirmó o las descartó) salen de la cola.
 * `vigentes`: los ids de los borradores que el servidor todavía tiene.
 */
export function limpiarBorradoresResueltos(usuarioId: string, vigentes: readonly string[]): void {
  const lista = leerCola(usuarioId)
  const quedan = lista.filter((v) => v.estado.tipo !== 'enBorradores' || vigentes.includes(v.estado.ventaId))
  if (quedan.length !== lista.length) escribir(usuarioId, quedan)
}
