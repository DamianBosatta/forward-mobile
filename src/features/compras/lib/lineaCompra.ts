import type { CompraDetalle } from '@/libs/api-client'

/** UnidadCompra del servidor: en qué nivel de empaque viene la cantidad. */
export type UnidadCompra = 'Unidad' | 'Bulto' | 'BultoMadre'

/**
 * Línea de una compra en el teléfono. La cantidad va en la unidad elegida; el costo es SIEMPRE
 * por unidad (CompraDetalleDto.CostoUnitario: "2 bultos de 12 a $100 son 24 unidades a $100").
 */
export interface LineaCompra {
  productoId: string
  nombre: string
  cantidad: number
  unidad: UnidadCompra
  /** Unidades que trae una unidad de compra (1 en Unidad; el bulto del producto en Bulto). */
  unidadesPorUnidad: number
  /** null = sin costo: no hay uno previo y el usuario no lo cargó. Nunca se inventa. */
  costoUnitario: number | null
  /** Moneda del costo tal como la guardó el servidor; sin valor (línea nueva) se manda ARS. */
  monedaCosto?: string
}

export function sinCosto(l: LineaCompra): boolean {
  return l.costoUnitario === null || l.costoUnitario <= 0
}

export function unidadesDe(l: LineaCompra): number {
  return l.cantidad * l.unidadesPorUnidad
}

/** Subtotal sin descuento global; null si la línea no tiene costo. */
export function subtotalDe(l: LineaCompra): number | null {
  return sinCosto(l) ? null : unidadesDe(l) * l.costoUnitario!
}

/** Total con la misma cuenta que el servidor (TotalesCompra): bruto con descuento más gastos. */
export function totalCompra(lineas: LineaCompra[], descuentoPorcentaje: number, gastos: number): number {
  const bruto = lineas.reduce((acc, l) => acc + (subtotalDe(l) ?? 0), 0)
  return bruto * (1 - descuentoPorcentaje / 100) + gastos
}

/**
 * Detalles para PUT /Compras/{id}. Mientras es borrador el servidor acepta costo 0 (línea a medio
 * cargar); guardar la nota o confirmar exige costo > 0, y eso lo vuelve a validar el servidor.
 */
export function detallesParaServidor(lineas: LineaCompra[]) {
  return lineas.map((l) => ({
    productoId: l.productoId,
    cantidad: l.cantidad,
    costoUnitario: l.costoUnitario ?? 0,
    monedaCosto: l.monedaCosto ?? 'ARS',
    unidadCompra: l.unidad,
  }))
}

/** Línea del teléfono a partir del detalle que devuelve GET /Compras/{id}. */
export function lineaDesdeDetalle(d: CompraDetalle): LineaCompra {
  const ingresada = d.cantidadIngresada > 0 ? d.cantidadIngresada : d.cantidad
  return {
    productoId: d.productoId,
    nombre: d.nombreProducto,
    cantidad: ingresada,
    unidad: d.unidadCompra,
    unidadesPorUnidad: ingresada > 0 ? d.cantidad / ingresada : 1,
    costoUnitario: d.costoUnitarioBaseAmount > 0 ? d.costoUnitarioBaseAmount : null,
    monedaCosto: d.moneda ?? undefined,
  }
}

/** Umbral del aviso de cambio de costo (plan 9 §2.2): más del 50 % respecto del último. */
export const UMBRAL_CAMBIO_COSTO = 50

/**
 * Cuánto cambia el costo tipeado respecto del último costo del producto, en %. null si no hay
 * último costo (no llegó: sin permiso o nunca se compró) o si no cambia.
 */
export function cambioDeCosto(costo: number | null, ultimo: number | null | undefined): { pct: number; fuerte: boolean } | null {
  if (costo === null || costo <= 0 || ultimo == null || ultimo <= 0 || costo === ultimo) return null
  const pct = ((costo - ultimo) / ultimo) * 100
  return { pct, fuerte: Math.abs(pct) > UMBRAL_CAMBIO_COSTO }
}

/**
 * Empaques en los que se puede comprar el producto, con las unidades de cada uno (misma regla que
 * EmpaqueProducto del servidor). `bultoMadreContenido` cuenta BULTOS, no unidades: un bulto madre de
 * 4 bultos de 12 son 48 unidades.
 */
export function unidadesDisponibles(ficha: { bultoContenido?: number | null; bultoMadreContenido?: number | null } | undefined) {
  const porBulto = ficha?.bultoContenido && ficha.bultoContenido > 0 ? ficha.bultoContenido : 1
  const opciones: { unidad: UnidadCompra; unidades: number }[] = [{ unidad: 'Unidad', unidades: 1 }]
  if (porBulto > 1) opciones.push({ unidad: 'Bulto', unidades: porBulto })
  if (ficha?.bultoMadreContenido && ficha.bultoMadreContenido > 0) opciones.push({ unidad: 'BultoMadre', unidades: porBulto * ficha.bultoMadreContenido })
  return opciones
}
