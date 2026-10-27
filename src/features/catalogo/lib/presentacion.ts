import type { ChipInfo } from '@/core/ui/fw'
import type { Producto } from '@/libs/api-client/types'

/** Lo que dibuja la tarjeta del catálogo: sale de la ficha de /catalogo (no hay venta mínima ahí). */
export type ProductoDeTarjeta = Pick<Producto, 'id' | 'nombre' | 'codigoPropio' | 'precioVenta' | 'imageUrl'> &
  Partial<Pick<Producto, 'esPadreDeVariantes' | 'cantidadFragancias' | 'ventaMinimaUnidades'>>

/** Hay stock / Sin stock, con el booleano que decide el servidor. Sin dato, sin chip: no se inventa. */
export function chipDeStock(puedeVenderse: boolean | null | undefined): ChipInfo | null {
  if (puedeVenderse == null) return null
  return puedeVenderse ? { estado: 'entregado', label: 'Hay stock' } : { estado: 'anulado', label: 'Sin stock' }
}

/** "Se vende por caja de N" cuando la venta mínima es más de una unidad. */
export function textoUnidadDeVenta(ventaMinimaUnidades: number | null | undefined): string {
  const n = ventaMinimaUnidades ?? 1
  return n > 1 ? `Se vende por caja de ${n}` : 'Se vende por unidad'
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
