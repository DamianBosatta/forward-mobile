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

/** Agrupa las variantes de una misma línea padre, en el orden en que aparece la primera. */
export function agruparLineas(lineas: LineaCarrito[]): GrupoLineas[] {
  const grupos: GrupoLineas[] = []
  for (const l of lineas) {
    const padreId = l.producto.productoPadreId
    if (!padreId) {
      grupos.push({ tipo: 'producto', linea: l })
      continue
    }
    const g = grupos.find((x) => x.tipo === 'fragancias' && x.padreId === padreId)
    if (g && g.tipo === 'fragancias') g.lineas.push(l)
    else grupos.push({ tipo: 'fragancias', padreId, lineas: [l] })
  }
  return grupos
}

export const cantidadDeFragancias = (lineas: LineaCarrito[], padreId: string) =>
  lineas.reduce((acc, l) => acc + (l.producto.productoPadreId === padreId ? l.cantidad : 0), 0)

/**
 * Reparte la línea: las fragancias de `padreId` pasan a ser exactamente `cantidades` (0 = fuera).
 * Cada variante conserva su descuento; una fragancia nueva toma el de las que ya estaban (el
 * descuento es de la línea, como en la web). El grupo queda donde estaba; si es nuevo, al final.
 */
export function repartirFragancias(
  lineas: LineaCarrito[],
  padreId: string,
  variantes: CatalogoStockItem[],
  cantidades: Record<string, number>,
): LineaCarrito[] {
  const previas = lineas.filter((l) => l.producto.productoPadreId === padreId)
  const descuentoDeLaLinea = previas[0]?.descuentoPct ?? 0
  const nuevas = variantes
    .filter((v) => (cantidades[v.id] ?? 0) > 0)
    .map((v) => ({
      productoId: v.id,
      producto: v,
      cantidad: cantidades[v.id],
      descuentoPct: previas.find((l) => l.productoId === v.id)?.descuentoPct ?? descuentoDeLaLinea,
    }))
  const donde = lineas.findIndex((l) => l.producto.productoPadreId === padreId)
  const resto = lineas.filter((l) => l.producto.productoPadreId !== padreId)
  if (donde < 0) return [...resto, ...nuevas]
  const antes = lineas.slice(0, donde).filter((l) => l.producto.productoPadreId !== padreId).length
  return [...resto.slice(0, antes), ...nuevas, ...resto.slice(antes)]
}
