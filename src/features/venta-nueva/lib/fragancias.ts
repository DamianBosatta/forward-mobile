import type { CatalogoStockItem } from '@/libs/api-client'
import type { LineaCarrito } from './carrito'

/**
 * Fragancias (plan 9 §2.1, PR 2.4). Una línea padre (`esPadreDeVariantes`) no se vende sola: se
 * reparte en sus variantes, y cada variante viaja como un ítem propio (`productoId` = la
 * variante), igual que en la web (DistribucionFraganciasModal). Funciones puras.
 */

/** El servidor nombra la variante "<línea> - <fragancia>"; si el nombre no sigue esa forma, va entero. */
export function nombreFragancia(variante: Pick<CatalogoStockItem, 'nombre'>, padreNombre?: string): string {
  const prefijo = padreNombre ? `${padreNombre} - ` : null
  return prefijo && variante.nombre.startsWith(prefijo) ? variante.nombre.slice(prefijo.length) : variante.nombre
}

export type GrupoLineas =
  | { tipo: 'producto'; linea: LineaCarrito }
  | { tipo: 'fragancias'; padreId: string; lineas: LineaCarrito[] }

export type GrupoPorPadre<T> = { tipo: 'producto'; item: T } | { tipo: 'fragancias'; padreId: string; items: T[] }

/** Agrupa las variantes de una misma línea padre, en el orden en que aparece la primera. */
export function agruparPorPadre<T>(items: T[], padreDe: (item: T) => string | null | undefined): GrupoPorPadre<T>[] {
  const grupos: GrupoPorPadre<T>[] = []
  for (const item of items) {
    const padreId = padreDe(item)
    const g = padreId ? grupos.find((x) => x.tipo === 'fragancias' && x.padreId === padreId) : undefined
    if (g && g.tipo === 'fragancias') g.items.push(item)
    else grupos.push(padreId ? { tipo: 'fragancias', padreId, items: [item] } : { tipo: 'producto', item })
  }
  return grupos
}

export function agruparLineas(lineas: LineaCarrito[]): GrupoLineas[] {
  return agruparPorPadre(lineas, (l) => l.producto.productoPadreId).map((g) =>
    g.tipo === 'producto' ? { tipo: 'producto', linea: g.item } : { tipo: 'fragancias', padreId: g.padreId, lineas: g.items })
}

export const cantidadDeFragancias = (lineas: LineaCarrito[], padreId: string) =>
  lineas.reduce((acc, l) => acc + (l.producto.productoPadreId === padreId ? l.cantidad : 0), 0)

/**
 * Cuántas unidades se pueden pedir de una fragancia, como la web (resolverStockDisponibleVarianteUI
 * + clampCantidadVariante): quien ve cantidades, el stock disponible del servidor en el depósito
 * (sin dato = 0, falla cerrado); quien no, sin límite si el servidor dice que puede venderse y 0 si no.
 */
export function stockDeFragancia(
  variante: Pick<CatalogoStockItem, 'disponible' | 'puedeVenderse'>,
  delServidor: { stockDisponible?: number | null; puedeVenderse?: boolean | null } | undefined,
  verCantidades: boolean,
): number {
  if (!verCantidades) return (delServidor?.puedeVenderse ?? variante.puedeVenderse) ? Number.POSITIVE_INFINITY : 0
  return Math.max(0, Math.floor(delServidor ? (delServidor.stockDisponible ?? 0) : variante.disponible))
}

/** El descuento de la línea de fragancias: es uno solo para todas sus variantes (como en la web). */
export const descuentoDeFragancias = (lineas: LineaCarrito[], padreId: string) =>
  lineas.find((l) => l.producto.productoPadreId === padreId)?.descuentoPct ?? 0

/**
 * Reparte la línea: las fragancias de `padreId` pasan a ser exactamente `cantidades` (0 = fuera),
 * todas con el MISMO `descuentoPct` (el descuento es de la línea, como en la web). El grupo queda
 * donde estaba; si es nuevo, al final.
 */
export function repartirFragancias(
  lineas: LineaCarrito[],
  padreId: string,
  variantes: CatalogoStockItem[],
  cantidades: Record<string, number>,
  descuentoPct: number,
): LineaCarrito[] {
  const nuevas = variantes
    .filter((v) => (cantidades[v.id] ?? 0) > 0)
    .map((v) => ({ productoId: v.id, producto: v, cantidad: cantidades[v.id], descuentoPct }))
  const donde = lineas.findIndex((l) => l.producto.productoPadreId === padreId)
  const resto = lineas.filter((l) => l.producto.productoPadreId !== padreId)
  if (donde < 0) return [...resto, ...nuevas]
  const antes = lineas.slice(0, donde).filter((l) => l.producto.productoPadreId !== padreId).length
  return [...resto.slice(0, antes), ...nuevas, ...resto.slice(antes)]
}
