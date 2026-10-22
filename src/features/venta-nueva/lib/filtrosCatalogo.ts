import type { CatalogoStockItem } from '@/libs/api-client'

/** Chips del catálogo rápido (lámina CalleCatalogo). La línea y la familia no son chips: el servidor ya busca por ellas. */
export interface FiltrosCatalogo {
  delUltimo: boolean
  conOferta: boolean
  hayStock: boolean
}

export const FILTROS_VACIOS: FiltrosCatalogo = { delUltimo: false, conOferta: false, hayStock: false }

/**
 * Filtra con lo que el servidor ya mandó (oferta vigente, `puedeVenderse`) y con los productos del último
 * pedido. Una línea con fragancias entra por "Del último pedido" si el último llevó alguna de sus fragancias
 * (las variantes salen de la misma lista).
 */
export function filtrarCatalogo(
  productos: CatalogoStockItem[],
  f: FiltrosCatalogo,
  idsDelUltimo: ReadonlySet<string>,
): CatalogoStockItem[] {
  const delUltimo = (p: CatalogoStockItem) => idsDelUltimo.has(p.id)
    || (p.esPadreDeVariantes && productos.some((v) => v.productoPadreId === p.id && idsDelUltimo.has(v.id)))
  return productos.filter((p) => (!f.delUltimo || delUltimo(p)) && (!f.conOferta || p.precioConOferta != null) && (!f.hayStock || p.puedeVenderse))
}
