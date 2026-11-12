import type { CatalogoComercialItem } from '@/libs/api-client/catalogo'

type ConLista = Pick<CatalogoComercialItem, 'listaPrecioId' | 'listaPrecioNombre'>

/**
 * ¿Esta persona puede elegir la lista con la que sale el catálogo en PDF? Es la regla de la web
 * (`lista-precios-catalogo.ts`): el perfil no dice si vende con una lista asignada, lo dice el catálogo. El teléfono
 * no pide ninguna lista, así que a quien tiene una propia el servidor se la devuelve en los ítems; quien puede elegir
 * los recibe sin lista. Sin ítems no hay evidencia: no se ofrece elegir.
 */
export function puedeElegirLista(items: readonly ConLista[]): boolean {
  return items.length > 0 && items.every((i) => !i.listaPrecioId)
}

/** La lista con la que se calcularon los precios que se ven, si alguna. */
export function listaDeLosPrecios(items: readonly ConLista[]): string | null {
  return items.find((i) => i.listaPrecioNombre)?.listaPrecioNombre ?? null
}

/** Las escalas de descuento que el PDF en Lista puede imprimir (las mismas de la web, `descuentos-pdf.ts`). */
export const DESCUENTOS_DISPONIBLES = [5, 10, 15, 20] as const

/** Lo que imprime el servidor cuando no se manda nada. */
export const DESCUENTOS_POR_DEFECTO: readonly number[] = [5, 10, 15]

/**
 * La selección de descuentos como parámetros del pedido, como en la web: la de siempre no manda nada (el servidor ya
 * imprime 5, 10 y 15) y ninguna es `sinDescuentos`, porque omitir `descuentos` es "el default", no "ninguno".
 */
export function paramsDeDescuentos(seleccion: readonly number[]): { descuentos?: number[]; sinDescuentos?: boolean } {
  const ordenada = [...seleccion].sort((a, b) => a - b)
  if (ordenada.length === 0) return { sinDescuentos: true }
  const esDefault = ordenada.length === DESCUENTOS_POR_DEFECTO.length && ordenada.every((d, i) => d === DESCUENTOS_POR_DEFECTO[i])
  return esDefault ? {} : { descuentos: ordenada }
}
