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

/**
 * Número tal como lo tipea el usuario. es-AR: punto de miles, coma decimal ("2.176,50" → 2176.5,
 * "12,82" → 12.82). Como el teclado decimal de Android a veces solo ofrece ".", un único punto
 * seguido de 1 o 2 dígitos es decimal ("12.5", "2176.50"); punto + exactamente 3 dígitos (repetido
 * o no) son miles ("1.500", "12.345.678"). Un separador final ("12," / "12.") se acepta mientras
 * se tipea. Vacío o mal formado ("1,2,3", "1.2.3,4.5", "-5", "abc") → null (inválido).
 */
export function leerNumero(texto: string): number | null {
  const t = texto.trim()
  let normal: string
  if (/^\d{1,3}(\.\d{3})+(,\d*)?$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d+,\d*$/.test(t)) normal = t.replace(',', '.')
  else if (/^\d+(\.\d{1,2})?\.?$/.test(t)) normal = t
  else if (/^\d+$/.test(t)) normal = t
  else return null
  const n = Number(normal.replace(/\.$/, ''))
  return Number.isFinite(n) ? n : null
}

/** 12.82 → "12,82" (sin miles: es un campo editable). */
export function mostrarNumero(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
