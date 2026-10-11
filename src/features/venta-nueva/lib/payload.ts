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

/**
 * Autoguardado de un PEDIDO: el borrador nace Presupuesto en el servidor (CreateVentaBorradorCommand
 * no recibe tipo) y UpdateVenta rechaza en un Presupuesto todo descuento sobre el tope; un Pedido
 * legítimo quedaría en error permanente. El borrador guarda cada descuento hasta el tope y el valor
 * elegido viaja completo recién en el POST /Ventas del final (que lo manda a autorización).
 */
export function hastaElTope(v: AutoguardadoVenta, tope: number): AutoguardadoVenta {
  const t = (p: number) => Math.min(p, tope)
  return { ...v, descuentoGeneral: t(v.descuentoGeneral), items: v.items.map((i) => ({ ...i, descuentoPorcentaje: t(i.descuentoPorcentaje) })) }
}

/** ¿Algún descuento supera el tope? (con tope > 0; con 0 el servidor lo rechaza en cualquier tipo). */
export const superaElTope = (v: AutoguardadoVenta, tope: number) =>
  tope > 0 && [v.descuentoGeneral, ...v.items.map((i) => i.descuentoPorcentaje)].some((p) => p > tope)

type CreateVentaCommand = import('@/libs/api-client/generated/schema').components['schemas']['CreateVentaCommand']
/**
 * Cuerpo de POST /Ventas, atado al contrato (`CreateVentaCommand`): una clave que el comando no
 * tiene no compila. Los enums viajan como número, igual que la web y la venta de hoy.
 */
export type AltaVenta = Omit<CreateVentaCommand, 'tipoOperacion' | 'metodoEntrega' | 'vendedorId' | 'usuarioGeneradorId'> & {
  tipoOperacion: 1 | 2
  metodoEntrega: MetodoEntregaValue
}

export interface DatosAlta {
  clienteId: string
  depositoId: string
  esPedido: boolean
  claveIdempotencia: string
  motivoVentaSinStock?: string
  porcentajeComisionCedido?: number
}

/** Alta (buildVentaPayload de la web): el vendedor sale del token; el flete solo si es > 0; la cesión solo en Pedido. */
export function aAlta(lineas: LineaCarrito[], descuentoGeneral: number, cab: Cabecera, d: DatosAlta): AltaVenta {
  const { cargoFlete, ...resto } = aAutoguardado(lineas, descuentoGeneral, cab)
  const p: AltaVenta = {
    ...resto,
    clienteId: d.clienteId,
    depositoId: d.depositoId,
    tipoOperacion: d.esPedido ? 2 : 1,
    entregaInmediata: false,
    claveIdempotencia: d.claveIdempotencia,
  }
  if (cargoFlete) p.cargoFlete = cargoFlete
  if (d.motivoVentaSinStock?.trim()) p.motivoVentaSinStock = d.motivoVentaSinStock.trim()
  if (d.esPedido && d.porcentajeComisionCedido) p.porcentajeComisionCedido = d.porcentajeComisionCedido
  return p
}

/** Clave de idempotencia de un alta (A.4 del servidor): única por venta, < 200 caracteres. */
export const nuevaClaveIdempotencia = () =>
  `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
