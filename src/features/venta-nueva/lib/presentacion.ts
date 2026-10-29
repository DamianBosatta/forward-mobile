import type { CatalogoStockItem } from '@/libs/api-client'
import { multiploDe } from './carrito'

/**
 * Cómo se puede pedir un producto en "Cantidad y oferta" (decisión del 28-10, "Respetar la regla").
 * El carrito siempre guarda unidades; Bultos/Unidades solo cambia cómo las ingresa el vendedor.
 */
export type ModoCantidad = 'bultos' | 'unidades'

export interface Presentacion {
  /** Modos que se ofrecen; con uno solo no hay selector. */
  modos: ModoCantidad[]
  /** Unidades de un bulto cerrado (1 si el producto no tiene bulto). */
  unidadesPorBulto: number
  /** Se vende solo por caja cerrada: `fraccionMinimaVenta` = Bulto con venta mínima mayor a 1. */
  soloBultos: boolean
  /** Cuánto suma el "+" en cada modo, en las unidades de ese modo. */
  paso: Record<ModoCantidad, number>
}

export function presentacionDe(p: Pick<CatalogoStockItem, 'ventaMinimaUnidades' | 'fraccionMinimaVenta' | 'bultoContenido'>): Presentacion {
  const minimo = multiploDe(p)
  if (p.fraccionMinimaVenta === 'Bulto' && minimo > 1) {
    return { modos: ['bultos'], unidadesPorBulto: minimo, soloBultos: true, paso: { bultos: 1, unidades: minimo } }
  }
  const bulto = p.bultoContenido > 1 ? p.bultoContenido : 1
  // Un bulto que no es múltiplo de la venta mínima no se podría pedir cerrado: se ofrece solo por unidad.
  const hayBulto = bulto > 1 && bulto % minimo === 0
  return { modos: hayBulto ? ['bultos', 'unidades'] : ['unidades'], unidadesPorBulto: bulto, soloBultos: false, paso: { bultos: 1, unidades: minimo } }
}

/** La pastilla de la tarjeta del catálogo: "Bulto x 6 u" si hay bulto o múltiplo de venta, "Unidad" si no. */
export function rotuloPresentacion(pr: Presentacion): string {
  if (pr.modos.includes('bultos')) return `Bulto x ${pr.unidadesPorBulto} u`
  return pr.paso.unidades > 1 ? `Bulto x ${pr.paso.unidades} u` : 'Unidad'
}

/** Lo ingresado en un modo, en unidades (Bultos × N). */
export function unidadesDe(pr: Presentacion, modo: ModoCantidad, valor: number): number {
  return modo === 'bultos' ? valor * pr.unidadesPorBulto : valor
}

/** Unidades expresadas en un modo (30 u → 3 bultos de 10). */
export function valorEn(pr: Presentacion, modo: ModoCantidad, unidades: number): number {
  return modo === 'bultos' ? unidades / pr.unidadesPorBulto : unidades
}

/** Unidades que quedan al pasar a un modo: a Bultos se redondea hacia arriba al próximo bulto cerrado (mínimo uno). */
export function convertirModo(pr: Presentacion, modo: ModoCantidad, unidades: number): number {
  if (modo === 'unidades') return unidades
  return Math.max(1, Math.ceil(unidades / pr.unidadesPorBulto)) * pr.unidadesPorBulto
}

/**
 * Descuentos de un toque (por línea y a toda la venta): 0 / 5 / 10 / 15 % más el tope del vendedor, sin pasarse de él
 * (quien está exento no tiene tope). Para otro valor está "Otro", que sí deja pasarse y avisa que queda por autorizar.
 */
export function chipsDeDescuento(tope: number, exento: boolean): number[] {
  const base = [0, 5, 10, 15].filter((p) => exento || p <= tope)
  return exento || tope <= 0 || base.includes(tope) ? base : [...base, tope].sort((a, b) => a - b)
}
