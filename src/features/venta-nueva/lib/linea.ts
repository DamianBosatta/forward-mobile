import type { CatalogoStockItem } from '@/libs/api-client'
import { derivarFloorBroken, esPrecioValido } from '@/features/ventas/lib/descuentos'

/**
 * Avisos de "Editar línea" (plan 9 §2.1). Son avisos, no decisiones: comparan con los
 * datos que ya mandó el servidor (tope del perfil, precio mínimo, costo directo) y el
 * servidor vuelve a evaluar todo al guardar. La matemática del descuento y del piso es
 * la de ventas/lib/descuentos.ts; acá solo se elige qué aviso mostrar.
 */

/** Mismo texto que VendedorDiscountCapPolicy.cs y la web para quien no tiene tope configurado. */
export const MENSAJE_TOPE_SIN_CONFIGURAR =
  'No tenés un límite de descuento configurado. Comunicate con el administrador para poder aplicar descuentos.'

export type AvisoTope = 'porAutorizar' | 'sinConfigurar' | null

/**
 * Tope del vendedor (`maxDescuentoPorcentaje` del perfil). Con tope > 0, pasarse va a
 * autorización. Con 0 (sin perfil o tope en 0) cualquier descuento rebota, salvo que tenga
 * CAP_EXENTO_TOPE_DESCUENTO (mismo corte que resolverEstadoTopeDescuentoVendedor de la web).
 */
export function avisoTope(pct: number, tope: number, exento: boolean): AvisoTope {
  if (tope > 0) return pct > tope ? 'porAutorizar' : null
  return pct > 0 && !exento ? 'sinConfigurar' : null
}

export type AvisoPiso = 'rojo' | 'amarillo' | null

/**
 * Piso de la línea con el descuento por ítem. Rojo: debajo del costo directo (el servidor
 * la rechaza; el dato solo llega con CAP_VER_COSTOS). Amarillo: debajo del precio mínimo
 * rentable (va a autorización). Piso desconocido: sin aviso (fail-open, REQ-BANDS-03).
 */
export function avisoPiso(
  producto: Pick<CatalogoStockItem, 'precioMinimoRentable' | 'costoDirecto'>,
  precioBase: number,
  pct: number,
): AvisoPiso {
  const efectivo = precioBase * (1 - pct / 100)
  if (producto.costoDirecto != null && !esPrecioValido(efectivo, producto.costoDirecto)) return 'rojo'
  const roto = derivarFloorBroken({ descItemPct: pct, descGeneralPct: 0, precioVenta: precioBase, precioMinimo: producto.precioMinimoRentable })
  return roto ? 'amarillo' : null
}

/** "2.176,50" → 2176.5; "12.82" → 12.82; vacío o inválido → 0. */
export function leerNumero(texto: string): number {
  const limpio = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  const n = Number(limpio.trim() || 0)
  return Number.isFinite(n) ? n : 0
}

/** 12.82 → "12,82" (sin miles: es un campo editable). */
export function mostrarNumero(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
