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
    monedaCosto: 'ARS',
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
  }
}
