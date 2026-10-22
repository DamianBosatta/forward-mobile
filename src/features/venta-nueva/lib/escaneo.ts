import type { CatalogoStockItem } from '@/libs/api-client'

export type CodigoResuelto =
  | { tipo: 'producto'; producto: CatalogoStockItem }
  | { tipo: 'fragancias'; padreId: string }

/**
 * Qué es un código leído en la góndola: el producto (por código de barras, propio o del proveedor), o la
 * línea de fragancias si el código es de una fragancia o de la línea misma (una fragancia no se vende suelta).
 * Sin coincidencia exacta, null: no se adivina.
 */
export function resolverCodigo(productos: CatalogoStockItem[], leido: string): CodigoResuelto | null {
  const codigo = leido.trim().toLowerCase()
  if (!codigo) return null
  const p = productos.find((x) => [x.codigoBarra, x.codigoPropio, x.codigoProveedor].some((v) => v != null && v.trim().toLowerCase() === codigo))
  if (!p) return null
  if (p.productoPadreId) return { tipo: 'fragancias', padreId: p.productoPadreId }
  return p.esPadreDeVariantes ? { tipo: 'fragancias', padreId: p.id } : { tipo: 'producto', producto: p }
}
