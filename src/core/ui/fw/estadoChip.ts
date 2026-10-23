import type { ChipEstado } from '@/libs/theme'
import {
  resolverEstadoVenta,
  type EstadoCompraNombre,
  type EstadoVentaNombre,
} from '@/libs/reglas/estados'

export interface ChipInfo {
  estado: ChipEstado
  label: string
}

export const CHIP_LABEL: Record<ChipEstado, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  porAutorizar: 'Por autorizar',
  enCurso: 'En curso',
  entregado: 'Entregado',
  anulado: 'Anulado',
}

const chip = (estado: ChipEstado, label = CHIP_LABEL[estado]): ChipInfo => ({ estado, label })

// Mapeo ÚNICO estado del backend → chip. Clave: nombre del enum (exhaustivo: un estado nuevo sin
// chip no compila); el número lo resuelve resolverEstadoVenta (libs/reglas/estados), porque el
// servidor manda uno u otro según el endpoint.
// Casos sin chip obvio en la lámina F4 (decisión documentada):
//   NoEntregada           → porAutorizar: no es terminal y pide que alguien actúe.
//   Vencido               → pendiente: presupuesto viejo que se puede reabrir.
//   RechazadaAutorizacion → anulado: terminal, pero con su propia etiqueta.
const VENTA = {
  Pendiente: chip('pendiente'),
  Confirmada: chip('confirmado'),
  EnPreparacion: chip('enCurso', 'En preparación'),
  Empacada: chip('enCurso', 'Empacado'),
  EnRuta: chip('enCurso', 'En ruta'),
  Entregada: chip('entregado'),
  NoEntregada: chip('porAutorizar', 'No entregado'),
  Anulada: chip('anulado'),
  PendienteAutorizacion: chip('porAutorizar'),
  Vencido: chip('pendiente', 'Vencido'),
  RechazadaAutorizacion: chip('anulado', 'Rechazado'),
} satisfies Record<EstadoVentaNombre, ChipInfo>

// Lámina F4: la nota de pedido usa "Pendiente" y lo que espera llegar, "Por recibir".
const COMPRA = {
  NotaPedido: chip('pendiente'),
  Confirmado: chip('enCurso', 'Por recibir'),
  Entregado: chip('entregado', 'Recibido'),
  Cancelada: chip('anulado', 'Cancelado'),
  Anulada: chip('anulado'),
} satisfies Record<EstadoCompraNombre, ChipInfo>

// Valor de Domain/Enum/EstadoCompra.cs: la tabla compartida todavía no lo trae (solo el de venta y
// hoja de ruta). Exhaustivo igual, así un estado nuevo no se cuela sin número.
const CODIGO_COMPRA = {
  NotaPedido: 1,
  Confirmado: 2,
  Entregado: 3,
  Cancelada: 4,
  Anulada: 5,
} satisfies Record<EstadoCompraNombre, number>

const esNombreDeCompra = (s: string): s is EstadoCompraNombre =>
  Object.prototype.hasOwnProperty.call(COMPRA, s)

/** Chip de un estado de venta o compra. `null` si el estado no se conoce: no se inventa. */
export function chipForEstado(
  tipo: 'venta' | 'compra',
  estado: string | number | null | undefined,
): ChipInfo | null {
  if (estado == null) return null
  if (tipo === 'venta') {
    const r = resolverEstadoVenta(estado)
    return r ? VENTA[r.nombre] : null
  }
  const s = String(estado)
  if (esNombreDeCompra(s)) return COMPRA[s]
  const porCodigo = (Object.keys(CODIGO_COMPRA) as EstadoCompraNombre[]).find(
    (n) => String(CODIGO_COMPRA[n]) === s,
  )
  return porCodigo ? COMPRA[porCodigo] : null
}
