import { redondear2 } from '@/libs/reglas/dinero'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { precioServidor, totalEstimado, type LineaCarrito } from './carrito'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoPiso, avisoTope } from './linea'

/**
 * Avisos de la venta ANTES de guardar (plan 9 §2.1), con lo que el servidor ya mandó (tope del
 * perfil, precio mínimo, costo con permiso, stock). No deciden nada: al confirmar, el servidor
 * vuelve a evaluar todo (y además mira deuda vencida y tope de crédito del cliente).
 */
export interface ContextoAvisos {
  tipo: TipoDocumento
  tope: number
  exento: boolean
  descuentoGeneral: number
}

/** Descuento compuesto de la línea con el general: (1 − ítem) × (1 − general), como el servidor. */
export const pctCompuesto = (item: number, general: number) => 100 * (1 - (1 - item / 100) * (1 - general / 100))

/** Alguna línea o el descuento general pasan el tope de descuento del vendedor (con tope configurado). */
export function superaElTope(lineas: LineaCarrito[], descuentoGeneral: number, tope: number, exento: boolean): boolean {
  return [...lineas.map((l) => l.descuentoPct), descuentoGeneral].some((p) => avisoTope(p, tope, exento) === 'porAutorizar')
}

export function avisosVenta(lineas: LineaCarrito[], ctx: ContextoAvisos): { porAutorizar: string[]; rechazos: string[] } {
  const topes = [...lineas.map((l) => l.descuentoPct), ctx.descuentoGeneral].map((p) => avisoTope(p, ctx.tope, ctx.exento))
  const pisos = lineas.map((l) => avisoPiso(l.producto, precioServidor(l.producto), pctCompuesto(l.descuentoPct, ctx.descuentoGeneral)))
  const superaTope = topes.includes('porAutorizar')
  const esPedido = ctx.tipo === 'Pedido'
  const porAutorizar: string[] = []
  const rechazos: string[] = []
  if (topes.includes('sinConfigurar')) rechazos.push(MENSAJE_TOPE_SIN_CONFIGURAR)
  if (superaTope && !esPedido) rechazos.push('Un presupuesto no admite descuentos por encima de tu tope: el sistema lo va a rechazar.')
  if (pisos.includes('rojo')) rechazos.push('Un precio queda debajo del costo: el sistema lo va a rechazar.')
  if (!esPedido) return { porAutorizar, rechazos }
  if (superaTope) porAutorizar.push('un descuento supera tu tope')
  if (pisos.includes('amarillo')) porAutorizar.push('un precio queda debajo del mínimo')
  if (lineas.some((l) => l.cantidad > l.producto.real)) porAutorizar.push('falta stock')
  return { porAutorizar, rechazos }
}

/** Totales ESTIMADOS (el real lo calcula el servidor al guardar). */
export function totalesEstimados(lineas: LineaCarrito[], descuentoGeneral: number, flete = 0) {
  const subtotal = totalEstimado(lineas)
  // Bloque 13 (R15): la cabecera sale de los subtotales redondeados; descuento y total, a 2 decimales.
  const descuento = redondear2(subtotal * (descuentoGeneral / 100))
  return { subtotal, descuento, flete, total: redondear2(subtotal - descuento + flete) }
}
