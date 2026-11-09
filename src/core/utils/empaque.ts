import { mostrarNumero } from './numero'

/** UnidadCompra del servidor: en qué nivel de empaque viene la cantidad (3 = Pack). */
export type UnidadCompra = 'Unidad' | 'Pack' | 'Bulto' | 'BultoMadre'

/** Lo único de la ficha que hace falta para convertir. */
export interface EmpaqueProducto {
  /** Unidades por pack (la fracción de venta). 1, 0 o sin dato = el producto no tiene pack. */
  ventaMinimaUnidades?: number | null
  /** Unidades por bulto. */
  bultoContenido?: number | null
  /** Bultos por bulto madre. */
  bultoMadreContenido?: number | null
}

/**
 * Unidades que trae un pack, o null si el producto se vende suelto. Única regla de "tiene pack" de
 * mobile (misma que `EmpaqueProducto.UnidadesPorPack` del servidor y `unidadesPorPack` de la web):
 * venta la usa para su múltiplo y compra para el nivel Pack.
 */
export function unidadesPorPack(ventaMinimaUnidades: number | null | undefined): number | null {
  return ventaMinimaUnidades != null && ventaMinimaUnidades > 1 ? ventaMinimaUnidades : null
}

/**
 * Niveles en que se compra el producto, de menor a mayor, con las unidades de cada uno. Pack solo
 * si el pack trae más de una unidad; Bulto solo si trae más de una; Bulto madre si está cargado y
 * se cuenta en UNIDADES (bulto × bultos por madre): el pack no los vuelve a multiplicar.
 */
export function nivelesDeEmpaque(ficha: EmpaqueProducto | null | undefined): { unidad: UnidadCompra; unidades: number }[] {
  const niveles: { unidad: UnidadCompra; unidades: number }[] = [{ unidad: 'Unidad', unidades: 1 }]
  const pack = unidadesPorPack(ficha?.ventaMinimaUnidades)
  if (pack != null) niveles.push({ unidad: 'Pack', unidades: pack })
  const porBulto = ficha?.bultoContenido && ficha.bultoContenido > 0 ? ficha.bultoContenido : 1
  if (porBulto > 1) niveles.push({ unidad: 'Bulto', unidades: porBulto })
  if (ficha?.bultoMadreContenido && ficha.bultoMadreContenido > 0) niveles.push({ unidad: 'BultoMadre', unidades: porBulto * ficha.bultoMadreContenido })
  return niveles
}

/**
 * Cómo viene el producto, nivel por nivel (mismo texto que `presentacionEmpaque` de la web):
 * `['Pack x8', 'Bulto 36 packs · 288 u.', 'B. madre 10 bultos · 2.880 u.']`.
 */
export function presentacionEmpaque(ficha: EmpaqueProducto | null | undefined): string[] {
  const niveles = nivelesDeEmpaque(ficha)
  const unidadesDe = (u: UnidadCompra) => niveles.find((n) => n.unidad === u)?.unidades ?? null
  const miles = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
  const pack = unidadesDe('Pack')
  const bulto = unidadesDe('Bulto')
  const madre = unidadesDe('BultoMadre')
  const partes: string[] = []
  if (pack != null) partes.push(`Pack x${mostrarNumero(pack)}`)
  if (bulto != null) {
    const packs = pack != null ? bulto / pack : 0
    partes.push(packs >= 1 && Number.isInteger(packs) ? `Bulto ${miles(packs)} ${packs === 1 ? 'pack' : 'packs'} · ${miles(bulto)} u.` : `Bulto ${miles(bulto)} u.`)
  }
  if (madre != null) {
    partes.push(bulto != null ? `B. madre ${miles(ficha?.bultoMadreContenido ?? 0)} bultos · ${miles(madre)} u.` : `B. madre ${miles(madre)} u.`)
  }
  return partes
}
