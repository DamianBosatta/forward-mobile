/**
 * Estados con nombre: etiqueta y tono de cada valor de los enums del backend (C-016, L-33).
 *
 * Una sola tabla por enum, exhaustiva: `Record<Nombre, …>` hace que un valor nuevo sin mapear no
 * compile, y no hay `default` que invente un estado (D-022, D-023). Los nombres son los que el
 * backend publica en `openapi.json` (schemas `EstadoVenta`, `EstadoCompra`, `EstadoHojaRuta`);
 * un test del web compara las claves de estas tablas con esos enums.
 *
 * Puro: sin React ni CSS. El `tono` es un token neutro; cada app lo traduce a su estilo
 * (la web: `badge badge-<tono>`).
 */

/** Token de color compartido por web y mobile. `neutro` es el chip sin color propio. */
export type TonoEstado =
  | 'neutro'
  | 'pendiente'
  | 'confirmada'
  | 'preparacion'
  | 'empacada'
  | 'enruta'
  | 'entregada'
  | 'noentregada'
  | 'anulada'
  | 'autorizacion'

export interface EstadoInfo {
  etiqueta: string
  tono: TonoEstado
}

// ── Venta ────────────────────────────────────────────────────────────────────

export type EstadoVentaNombre =
  | 'Pendiente'
  | 'Confirmada'
  | 'EnPreparacion'
  | 'Empacada'
  | 'EnRuta'
  | 'Entregada'
  | 'NoEntregada'
  | 'Anulada'
  | 'PendienteAutorizacion'
  | 'Vencido'
  | 'RechazadaAutorizacion'

export interface EstadoVentaInfo extends EstadoInfo {
  /** Valor numérico del enum de C# (`Domain/Enum/EstadoVenta.cs`): algunos DTOs lo mandan así. */
  valor: number
}

export const ESTADO_VENTA = {
  Pendiente: { valor: 1, etiqueta: 'Pendiente', tono: 'pendiente' },
  Confirmada: { valor: 2, etiqueta: 'Confirmada', tono: 'confirmada' },
  EnPreparacion: { valor: 3, etiqueta: 'En Preparación', tono: 'preparacion' },
  Empacada: { valor: 4, etiqueta: 'Empacada', tono: 'empacada' },
  EnRuta: { valor: 5, etiqueta: 'En Ruta', tono: 'enruta' },
  Entregada: { valor: 6, etiqueta: 'Entregada', tono: 'entregada' },
  NoEntregada: { valor: 7, etiqueta: 'No Entregada', tono: 'noentregada' },
  Anulada: { valor: 8, etiqueta: 'Anulada', tono: 'anulada' },
  PendienteAutorizacion: { valor: 9, etiqueta: 'Por Autorizar', tono: 'autorizacion' },
  // Estado de autoguardado de presupuestos: tiene su propia UI, acá solo se nombra.
  Vencido: { valor: 10, etiqueta: 'Vencido', tono: 'neutro' },
  // Muerto como Anulada, pero sigue visible en la lista del vendedor.
  RechazadaAutorizacion: { valor: 11, etiqueta: 'Rechazada', tono: 'anulada' },
} as const satisfies Record<EstadoVentaNombre, EstadoVentaInfo>

// ── Compra ───────────────────────────────────────────────────────────────────

export type EstadoCompraNombre = 'NotaPedido' | 'Confirmado' | 'Entregado' | 'Cancelada' | 'Anulada'

export interface EstadoCompraInfo extends EstadoInfo {
  /** Cómo lo nombra la ficha del proveedor: para quien compra, la mercadería se RECIBE. */
  etiquetaFicha: string
}

export const ESTADO_COMPRA = {
  NotaPedido: { etiqueta: 'Nota de Pedido', etiquetaFicha: 'Nota de pedido', tono: 'pendiente' },
  Confirmado: { etiqueta: 'Confirmado', etiquetaFicha: 'Confirmada', tono: 'confirmada' },
  Entregado: { etiqueta: 'Entregado', etiquetaFicha: 'Recibida', tono: 'entregada' },
  Cancelada: { etiqueta: 'Cancelada', etiquetaFicha: 'Cancelada', tono: 'anulada' },
  // Recibida y después deshecha: distinta de Cancelada, que nunca llegó a mover stock.
  Anulada: { etiqueta: 'Anulada', etiquetaFicha: 'Anulada', tono: 'noentregada' },
} as const satisfies Record<EstadoCompraNombre, EstadoCompraInfo>

// ── Hoja de ruta ─────────────────────────────────────────────────────────────

export type EstadoHojaRutaNombre =
  | 'Programada'
  | 'EnCurso'
  | 'Finalizada'
  | 'Cancelada'
  | 'Documentada'

export interface EstadoHojaRutaInfo extends EstadoInfo {
  /** Valor numérico del enum de C#: `HojaRuta*Dto.estado` llega así. */
  valor: number
}

export const ESTADO_HOJA_RUTA = {
  Programada: { valor: 1, etiqueta: 'Programada', tono: 'pendiente' },
  EnCurso: { valor: 2, etiqueta: 'En Curso', tono: 'enruta' },
  Finalizada: { valor: 3, etiqueta: 'Finalizada', tono: 'entregada' },
  Cancelada: { valor: 4, etiqueta: 'Cancelada', tono: 'anulada' },
  Documentada: { valor: 5, etiqueta: 'Documentada', tono: 'pendiente' },
} as const satisfies Record<EstadoHojaRutaNombre, EstadoHojaRutaInfo>

// ── Búsqueda tolerante ───────────────────────────────────────────────────────

type Tabla<N extends string, I> = Readonly<Record<N, I & { valor?: number }>>

/**
 * Resuelve un estado que puede llegar como nombre ("Empacada"), número (4) o número en texto
 * ("4"). Devuelve `undefined` si no es ninguno de la tabla: quien llama decide cómo mostrarlo,
 * nunca se inventa un estado.
 */
function resolver<N extends string, I>(
  tabla: Tabla<N, I>,
  estado: string | number | null | undefined,
): { nombre: N; info: Tabla<N, I>[N] } | undefined {
  if (estado === null || estado === undefined) return undefined
  const texto = typeof estado === 'number' ? String(estado) : estado.trim()
  if (texto === '') return undefined
  const nombres = Object.keys(tabla) as N[]
  const numero = Number(texto)
  const nombre = Number.isNaN(numero)
    ? nombres.find((n) => n === texto)
    : nombres.find((n) => tabla[n].valor === numero)
  return nombre === undefined ? undefined : { nombre, info: tabla[nombre] }
}

export function resolverEstadoVenta(estado: string | number | null | undefined) {
  return resolver<EstadoVentaNombre, EstadoVentaInfo>(ESTADO_VENTA, estado)
}

export function resolverEstadoHojaRuta(estado: string | number | null | undefined) {
  return resolver<EstadoHojaRutaNombre, EstadoHojaRutaInfo>(ESTADO_HOJA_RUTA, estado)
}
