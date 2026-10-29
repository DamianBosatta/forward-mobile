import type { CatalogoStockItem } from '@/libs/api-client'
import { redondear2 } from '@/libs/reglas/dinero'
import { calcularSubtotalConDescuento } from '@/features/ventas/lib/descuentos'
import { bultosExactos, multiploDe, presentacionDe, unidadesDeBulto } from './presentacion'

export { multiploDe }
type DatosDeBulto = Pick<CatalogoStockItem, 'ventaMinimaUnidades' | 'fraccionMinimaVenta' | 'bultoContenido'>

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

/** "Se vende por caja de 6"; null si se vende por unidad. "Bulto" es la caja cerrada. */
export function leyendaMultiplo(producto: Pick<CatalogoStockItem, 'ventaMinimaUnidades' | 'fraccionMinimaVenta'>): string | null {
  const m = multiploDe(producto)
  if (m === 1) return null
  return `Se vende por ${producto.fraccionMinimaVenta === 'Bulto' ? 'caja' : 'pack'} de ${m}`
}

/** Unidades del bulto del producto (la regla única está en `presentacion.ts`); 1 si se vende por unidad. */
export const unidadesPorBultoDe = (producto: DatosDeBulto): number => unidadesDeBulto(presentacionDe(producto))

/** Se vende por bulto (caja o pack cerrado) cuando el bulto tiene más de una unidad. */
export const vendePorBulto = (producto: DatosDeBulto): boolean => unidadesPorBultoDe(producto) > 1

const rotuloBultos = (n: number): string => (n === 1 ? '1 bulto' : `${n} bultos`)

/** "3 bultos" / "1 bulto" si son bultos cerrados; si no, "12 u". `unidades` siempre viene en unidades. */
export function cantidadEnPresentacion(producto: DatosDeBulto, unidades: number): string {
  const bultos = bultosExactos(presentacionDe(producto), unidades)
  return bultos === null ? `${unidades} u` : rotuloBultos(bultos)
}

export type NivelStock = 'hay' | 'poco' | 'sin'

/**
 * Disponibilidad de la tarjeta. Con `verCantidades` sale del `disponible` del servidor (nunca de `real`);
 * sin esa capacidad el servidor manda `disponible = 0` y solo vale `puedeVenderse`, sin números.
 * `poco` = queda stock pero no más que el mínimo del producto. `enVivo` agrega " · ahora".
 */
export function stockDeTarjeta(
  p: Pick<CatalogoStockItem, 'disponible' | 'puedeVenderse' | 'stockMinimo'> & DatosDeBulto,
  verCantidades: boolean,
  enVivo = false,
): { nivel: NivelStock; texto: string } {
  if (!verCantidades) return p.puedeVenderse ? { nivel: 'hay', texto: 'Hay stock' } : { nivel: 'sin', texto: 'Sin stock · se puede pedir' }
  if (p.disponible <= 0) return { nivel: 'sin', texto: 'Sin stock · se puede pedir' }
  const poco = (p.stockMinimo ?? 0) > 0 && p.disponible <= (p.stockMinimo ?? 0)
  const porBulto = unidadesPorBultoDe(p)
  const queda = porBulto > 1 && p.disponible >= porBulto ? rotuloBultos(Math.floor(p.disponible / porBulto)) : `${p.disponible} u`
  return { nivel: poco ? 'poco' : 'hay', texto: `Quedan ${queda}${enVivo ? ' · ahora' : ''}` }
}

/** Resumen de la barra del carrito: productos y bultos (las líneas por unidad suman "u"). */
export function resumenCarrito(lineas: LineaCarrito[]): string {
  const productos = lineas.length === 1 ? '1 producto' : `${lineas.length} productos`
  const exactos = lineas.map((l) => bultosExactos(presentacionDe(l.producto), l.cantidad))
  const bultos = exactos.reduce<number>((a, n) => a + (n ?? 0), 0)
  const sueltas = lineas.reduce((a, l, i) => a + (exactos[i] === null ? l.cantidad : 0), 0)
  return [productos, bultos > 0 ? rotuloBultos(bultos) : null, sueltas > 0 ? `${sueltas} u` : null].filter(Boolean).join(' · ')
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
