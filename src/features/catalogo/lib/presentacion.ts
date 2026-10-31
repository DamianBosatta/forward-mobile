import { formatPorcentaje, type ChipInfo } from '@/core/ui/fw'
import type { Producto } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { diaArgentina } from '@/src/utils/date'

/** La marca de color que decide el servidor (sin stock > nuevo > precio nuevo), la misma del PDF. */
export type MarcaNovedad = components['schemas']['MarcaNovedad']

/** Lo que dibuja la tarjeta además de la ficha: la marca de novedad y cuánto cambió el precio de lista. */
export interface NovedadDeTarjeta {
  novedad?: MarcaNovedad
  precioAnterior?: number | null
  variacionPorcentaje?: number | null
}

/** Lo que dibuja la tarjeta del catálogo: sale de la ficha de /catalogo (no hay venta mínima ahí). */
export type ProductoDeTarjeta = Pick<Producto, 'id' | 'nombre' | 'codigoPropio' | 'precioVenta' | 'imageUrl'> &
  Partial<Pick<Producto, 'esPadreDeVariantes' | 'cantidadFragancias' | 'ventaMinimaUnidades'>> &
  NovedadDeTarjeta

/** Hay stock / Sin stock, con el booleano que decide el servidor. Sin dato, sin chip: no se inventa. */
export function chipDeStock(puedeVenderse: boolean | null | undefined): ChipInfo | null {
  if (puedeVenderse == null) return null
  return puedeVenderse ? { estado: 'entregado', label: 'Hay stock' } : { estado: 'anulado', label: 'Sin stock' }
}

/** Una forma de comprar el producto en "Cómo se vende": cuántas unidades trae y cuánto sale (precio de lista x unidades). */
export interface FormaDeVenta {
  clave: 'unidad' | 'pack' | 'bulto'
  label: string
  unidades: number
  precio: number
  /** La venta mínima: el renglón que se resalta. */
  destacada: boolean
}

/**
 * "Cómo se vende" de la ficha (lámina FichaProducto): Unidad, la venta mínima (`unidadesPorVenta`, igual a
 * `ventaMinimaUnidades`) y, si el producto tiene nivel de bulto (`bultoContenido`, null si el bulto es de 1) y
 * no coincide con la venta mínima, el bulto cerrado.
 */
export function formasDeVenta(p: {
  productoId: string
  precioVenta: number
  ventaMinimaUnidades?: number | null
  unidadesPorVenta?: number | null
  bultoContenido?: number | null
}): FormaDeVenta[] {
  const minima = p.unidadesPorVenta ?? p.ventaMinimaUnidades ?? 1
  const formas: FormaDeVenta[] = [{ clave: 'unidad', label: 'Unidad', unidades: 1, precio: p.precioVenta, destacada: false }]
  if (minima > 1) formas.push({ clave: 'bulto', label: 'Bulto · venta mínima', unidades: minima, precio: p.precioVenta * minima, destacada: true })
  const bulto = p.bultoContenido
  if (bulto != null && bulto > 1 && bulto !== minima) {
    formas.push({ clave: 'pack', label: 'Bulto cerrado', unidades: bulto, precio: p.precioVenta * bulto, destacada: false })
    formas.sort((x, y) => x.unidades - y.unidades)
  }
  return formas
}

/**
 * Renglón de la tarjeta: "12 fragancias · caja de 12" (lámina CatalogoConsulta). Las partes que el servidor no manda
 * (uno anterior a forward-system #894) no se inventan: una línea sin la cantidad sigue diciendo "Con fragancias" y
 * sin la venta mínima, o con venta por unidad, no hay "caja de N". null si no hay nada que mostrar.
 */
export function detalleDeTarjeta(p: Partial<Pick<Producto, 'esPadreDeVariantes' | 'cantidadFragancias' | 'ventaMinimaUnidades'>>): string | null {
  const partes: string[] = []
  if (p.esPadreDeVariantes) {
    partes.push(p.cantidadFragancias == null ? 'Con fragancias' : `${p.cantidadFragancias} ${p.cantidadFragancias === 1 ? 'fragancia' : 'fragancias'}`)
  }
  if (p.ventaMinimaUnidades != null && p.ventaMinimaUnidades > 1) partes.push(`caja de ${p.ventaMinimaUnidades}`)
  return partes.length ? partes.join(' · ') : null
}

/**
 * Filtro "Hay stock" del catálogo (lámina ModCatalogo): deja solo los productos que el servidor dijo que se pueden
 * vender. Sin el filtro, la lista queda igual. Una línea (sin dato) o un producto sin respuesta todavía no entran.
 */
export function filtrarPorStock<T extends { id: string }>(
  productos: T[],
  disponible: ReadonlyMap<string, boolean>,
  soloConStock: boolean,
): T[] {
  return soloConStock ? productos.filter((p) => disponible.get(p.id) === true) : productos
}

/** Ventana de novedades de la pantalla del catálogo: los últimos 30 días. */
export const DIAS_DE_NOVEDADES = 30

/** Ventanas que ofrece el PDF del catálogo. */
export const VENTANAS_DE_NOVEDADES = [7, 30, 90] as const

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Primer día de las novedades (YYYY-MM-DD, día argentino): hoy menos `dias`. Argentina no tiene horario de verano. */
export function novedadesDesde(dias: number, ahoraMs: number = Date.now()): string {
  return diaArgentina(ahoraMs - dias * MS_POR_DIA)
}

const CHIP_DE_NOVEDAD: Partial<Record<MarcaNovedad, ChipInfo>> = {
  Nuevo: { estado: 'entregado', label: 'Nuevo' },
  PrecioNuevo: { estado: 'porAutorizar', label: 'Precio nuevo' },
  SinStock: { estado: 'anulado', label: 'Sin stock' },
}

/**
 * Chip de la tarjeta: verde nuevo, ámbar precio nuevo, rojo sin stock (lámina Catálogo · tarjetas). La prioridad
 * la decide el servidor. Sin novedad, el chip de stock de siempre.
 */
export function chipDeTarjeta(novedad: MarcaNovedad | null | undefined, disponible: boolean | null | undefined): ChipInfo | null {
  return (novedad && CHIP_DE_NOVEDAD[novedad]) || chipDeStock(disponible)
}

/** "▲ 8,5 %" o "▼ 3,2 %"; null si el precio de lista no cambió. */
export function textoVariacion(variacionPorcentaje: number | null | undefined): string | null {
  if (variacionPorcentaje == null || !Number.isFinite(variacionPorcentaje) || variacionPorcentaje === 0) return null
  return `${variacionPorcentaje > 0 ? '▲' : '▼'} ${formatPorcentaje(Math.abs(variacionPorcentaje))}`
}
