import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import type { LineaCarrito } from './carrito'

/** Lo que viaja al servidor: producto, cantidad y descuento. El precio lo pone el servidor. */
export interface ItemVenta { productoId: string; cantidad: number; descuentoPorcentaje: number }

/** Cuerpo del autoguardado (UpdateVentaCommand; el id y la versión los pone la llamada). */
export interface AutoguardadoVenta { descuentoGeneral: number; metodoEntrega: MetodoEntregaValue; items: ItemVenta[] }

export const itemsDe = (lineas: LineaCarrito[]): ItemVenta[] =>
  lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, descuentoPorcentaje: l.descuentoPct }))

/** Por defecto, logística propia (como la web). */
export const aAutoguardado = (lineas: LineaCarrito[], descuentoGeneral = 0): AutoguardadoVenta =>
  ({ descuentoGeneral, metodoEntrega: METODO_ENTREGA.Logistica, items: itemsDe(lineas) })
