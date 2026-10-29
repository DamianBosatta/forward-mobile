import type { CatalogoStockItem } from '@/libs/api-client'
import { redondear2 } from '@/libs/reglas/dinero'
import { calcularSubtotalConDescuento } from '@/features/ventas/lib/descuentos'

/**
 * Carrito de la venta nueva (plan 9 §2.1). Funciones puras: el teléfono no pone
 * precios ni decide autorizaciones; solo lleva la cantidad elegida de cada producto
 * con los datos que mandó el servidor. El servidor valida todo al guardar.
 */
export interface LineaCarrito {
  productoId: string
  /** Fila del catálogo de venta tal cual la mandó el servidor (precio, piso, stock). */
  producto: CatalogoStockItem
  cantidad: number
  /** Descuento por línea en %; lo edita "Editar línea". */
  descuentoPct: number
}

/** Unidades por venta del producto: la cantidad va de a este múltiplo (6 → 6, 12, 18…). */
export function multiploDe(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades'>): number {
  const m = producto.ventaMinimaUnidades
  return m && m > 1 ? m : 1
}

/** "Se vende por caja de 6"; null si se vende por unidad. "Bulto" es la caja cerrada. */
export function leyendaMultiplo(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades' | 'fraccionMinimaVenta'>): string | null {
  const m = multiploDe(producto)
  if (m === 1) return null
  return `Se vende por ${producto.fraccionMinimaVenta === 'Bulto' ? 'caja' : 'pack'} de ${m}`
}

/** Se vende por bulto (caja o pack cerrado) cuando el múltiplo es mayor que 1. */
export const vendePorBulto = (producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades'>): boolean => multiploDe(producto) > 1

/** Pastilla de la tarjeta: "Bulto x 6 u" o "Unidad". */
export function presentacionDe(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades'>): string {
  return vendePorBulto(producto) ? `Bulto x ${multiploDe(producto)} u` : 'Unidad'
}

/** "3 bultos" / "1 bulto" si se vende por bulto; "12 u" si no. `unidades` siempre viene en unidades. */
export function cantidadEnPresentacion(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades'>, unidades: number): string {
  if (!vendePorBulto(producto)) return `${unidades} u`
  const bultos = Math.floor(unidades / multiploDe(producto))
  return bultos === 1 ? '1 bulto' : `${bultos} bultos`
}

export type NivelStock = 'hay' | 'poco' | 'sin'

/**
 * Disponibilidad de la tarjeta. Con `verCantidades` sale del `disponible` del servidor (nunca de `real`);
 * sin esa capacidad el servidor manda `disponible = 0` y solo vale `puedeVenderse`, sin números.
 * `poco` = queda stock pero no más que el mínimo del producto. `enVivo` agrega " · ahora".
 */
export function stockDeTarjeta(
  p: Pick<CatalogoStockItem, 'disponible' | 'puedeVenderse' | 'stockMinimo' | 'ventaMinimaUnidades'>,
  verCantidades: boolean,
  enVivo = false,
): { nivel: NivelStock; texto: string } {
  if (!verCantidades) return p.puedeVenderse ? { nivel: 'hay', texto: 'Hay stock' } : { nivel: 'sin', texto: 'Sin stock · se puede pedir' }
  if (p.disponible <= 0) return { nivel: 'sin', texto: 'Sin stock · se puede pedir' }
  const poco = (p.stockMinimo ?? 0) > 0 && p.disponible <= (p.stockMinimo ?? 0)
  const queda = multiploDe(p) > 1 && p.disponible < multiploDe(p) ? `${p.disponible} u` : cantidadEnPresentacion(p, p.disponible)
  return { nivel: poco ? 'poco' : 'hay', texto: `Quedan ${queda}${enVivo ? ' · ahora' : ''}` }
}

/** Resumen de la barra del carrito: productos y bultos (las líneas por unidad suman "u"). */
export function resumenCarrito(lineas: LineaCarrito[]): string {
  const productos = lineas.length === 1 ? '1 producto' : `${lineas.length} productos`
  const bultos = lineas.filter((l) => vendePorBulto(l.producto)).reduce((a, l) => a + l.cantidad / multiploDe(l.producto), 0)
  const sueltas = lineas.filter((l) => !vendePorBulto(l.producto)).reduce((a, l) => a + l.cantidad, 0)
  return [productos, bultos > 0 ? (bultos === 1 ? '1 bulto' : `${bultos} bultos`) : null, sueltas > 0 ? `${sueltas} u` : null].filter(Boolean).join(' · ')
}

/** Precio que muestra el servidor: la oferta vigente si la hay, si no la lista. */
export function precioServidor(producto: Pick<CatalogoStockItem, 'precioVenta' | 'precioConOferta'>): number {
  return producto.precioConOferta ?? producto.precioVenta
}

export function cantidadEn(lineas: LineaCarrito[], productoId: string): number {
  return lineas.find((l) => l.productoId === productoId)?.cantidad ?? 0
}

/** "+ Añadir": entra con un múltiplo; si ya estaba, suma uno más. */
export function agregar(lineas: LineaCarrito[], producto: CatalogoStockItem): LineaCarrito[] {
  if (lineas.some((l) => l.productoId === producto.id)) return sumar(lineas, producto.id)
  return [...lineas, { productoId: producto.id, producto, cantidad: multiploDe(producto), descuentoPct: 0 }]
}

export function sumar(lineas: LineaCarrito[], productoId: string): LineaCarrito[] {
  return lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad + multiploDe(l.producto) } : l))
}

/** Resta un múltiplo; si queda en 0 o menos, la línea sale del carrito. */
export function restar(lineas: LineaCarrito[], productoId: string): LineaCarrito[] {
  return lineas.flatMap((l) => {
    if (l.productoId !== productoId) return [l]
    const cantidad = l.cantidad - multiploDe(l.producto)
    return cantidad > 0 ? [{ ...l, cantidad }] : []
  })
}

export function quitar(lineas: LineaCarrito[], productoId: string): LineaCarrito[] {
  return lineas.filter((l) => l.productoId !== productoId)
}

/**
 * Reemplaza la línea editada (o la agrega si no estaba). En una fragancia, el descuento es de la
 * línea entera: editarlo en una variante lo cambia en todas las de su línea (como en la web).
 */
export function reemplazar(lineas: LineaCarrito[], linea: LineaCarrito): LineaCarrito[] {
  const padreId = linea.producto.productoPadreId
  const hermanas = (l: LineaCarrito) => (padreId && l.producto.productoPadreId === padreId ? { ...l, descuentoPct: linea.descuentoPct } : l)
  if (!lineas.some((l) => l.productoId === linea.productoId)) return [...lineas.map(hermanas), linea]
  return lineas.map((l) => (l.productoId === linea.productoId ? linea : hermanas(l)))
}

/** Subtotal de la línea: precio del servidor × cantidad con el descuento de la línea (igual que Editar línea). */
export function subtotalLinea(l: LineaCarrito): number {
  return calcularSubtotalConDescuento(precioServidor(l.producto), l.cantidad, l.descuentoPct)
}

/**
 * Total ESTIMADO: suma de los subtotales de línea (precio del servidor × cantidad, con el
 * descuento de cada línea). No suma impuestos ni flete: el total real lo calcula el servidor al guardar.
 */
export function totalEstimado(lineas: LineaCarrito[]): number {
  return redondear2(lineas.reduce((acc, l) => acc + subtotalLinea(l), 0))
}
