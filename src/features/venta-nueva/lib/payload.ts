import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import type { LineaCarrito } from './carrito'

/** Lo que viaja al servidor: producto, cantidad y descuento. El precio lo pone el servidor. */
export interface ItemVenta { productoId: string; cantidad: number; descuentoPorcentaje: number }

/** Cabecera elegida en la pestaña Cabecera. `fecha` es un día "YYYY-MM-DD" de Argentina. */
export interface Cabecera { metodoEntrega: MetodoEntregaValue; fecha: string | null; flete: number; observaciones: string }

/** Cuerpo del autoguardado (UpdateVentaCommand; el id y la versión los pone la llamada). */
export interface AutoguardadoVenta {
  descuentoGeneral: number
  metodoEntrega: MetodoEntregaValue
  items: ItemVenta[]
  fechaEntrega?: string
  cargoFlete?: number
  observaciones?: string
}

export const itemsDe = (lineas: LineaCarrito[]): ItemVenta[] =>
  lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, descuentoPorcentaje: l.descuentoPct }))

const SIN_CABECERA: Cabecera = { metodoEntrega: METODO_ENTREGA.Logistica, fecha: null, flete: 0, observaciones: '' }

/**
 * Snapshot del autoguardado, con las reglas de la web (buildUpdateVentaPayload): la fecha no va en
 * un retiro; el flete solo en logística propia (incluso 0: limpiarlo tiene que viajar); el retiro
 * deja el flete en 0 del lado del servidor. Las observaciones van si no están vacías.
 */
export function aAutoguardado(lineas: LineaCarrito[], descuentoGeneral = 0, cab: Cabecera = SIN_CABECERA): AutoguardadoVenta {
  const p: AutoguardadoVenta = { descuentoGeneral, metodoEntrega: cab.metodoEntrega, items: itemsDe(lineas) }
  if (cab.metodoEntrega !== METODO_ENTREGA.RetiroEnLocal && cab.fecha) p.fechaEntrega = cab.fecha
  if (cab.metodoEntrega === METODO_ENTREGA.Logistica) p.cargoFlete = cab.flete
  if (cab.observaciones.trim()) p.observaciones = cab.observaciones.trim()
  return p
}
