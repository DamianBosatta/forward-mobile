import type { CatalogoStockItem } from '@/libs/api-client'

/** Unidades por venta del producto: la cantidad va de a este múltiplo (6 → 6, 12, 18…). */
export function multiploDe(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades'>): number {
  const m = producto.ventaMinimaUnidades
  return m && m > 1 ? m : 1
}

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

/**
 * LA definición de "bulto" para mostrar y calcular precios (pastilla, precio por bulto de la tarjeta, resumen del
 * carrito, detalle de la revisión, pantalla de oferta): cuántas unidades tiene el bulto que ve el vendedor; 1 si el
 * producto se vende por unidad. Es el bulto que ofrece el selector de la oferta; si el bulto no se puede pedir
 * cerrado, el bulto es la venta mínima.
 */
export function unidadesDeBulto(pr: Presentacion): number {
  return pr.modos.includes('bultos') ? pr.unidadesPorBulto : pr.paso.unidades
}

/** Los bultos cerrados que hay en `unidades`, o null si no es un número exacto de bultos (o no hay bulto). */
export function bultosExactos(pr: Presentacion, unidades: number): number | null {
  const n = unidadesDeBulto(pr)
  return n > 1 && unidades > 0 && unidades % n === 0 ? unidades / n : null
}

/** La pastilla de la tarjeta del catálogo: "Bulto x 6 u" si hay bulto o múltiplo de venta, "Unidad" si no. */
export function rotuloPresentacion(pr: Presentacion): string {
  const n = unidadesDeBulto(pr)
  return n > 1 ? `Bulto x ${n} u` : 'Unidad'
}

/**
 * Cómo dice el vendedor cada modo en "Se vende por": "Unid." si se pide de a una, "Pack · N" si la venta mínima es N,
 * "Bulto · N" para la caja cerrada. Son los mismos modos Bultos/Unidades del carrito, con el nombre del mockup.
 */
export function rotuloDeModo(pr: Presentacion, modo: ModoCantidad): string {
  if (modo === 'bultos') return `Bulto · ${pr.unidadesPorBulto}`
  return pr.paso.unidades > 1 ? `Pack · ${pr.paso.unidades}` : 'Unid.'
}

/** El modo en que se muestra una cantidad: Bulto si es un número exacto de bultos y el producto lo ofrece; si no, unidades. */
export function modoDeCantidad(pr: Presentacion, unidades: number): ModoCantidad {
  return pr.modos.includes('bultos') && unidades % pr.unidadesPorBulto === 0 ? 'bultos' : 'unidades'
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
