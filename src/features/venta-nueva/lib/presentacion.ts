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

/** Descuentos de un toque: 0 / 5 / 10 / 15 % sin pasarse del tope del vendedor (quien está exento no tiene tope). */
export function chipsDeDescuento(tope: number, exento: boolean): number[] {
  return [0, 5, 10, 15].filter((p) => exento || p <= tope)
}
