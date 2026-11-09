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
 * Cuántas unidades suma un paso de Unidad: el pack (6 → 6, 12, 18…), 1 si el producto no tiene pack.
 * Venta y compra miden igual: nunca unidades sueltas de un producto con pack.
 */
export function pasoDeUnidad(ficha: EmpaqueProducto | null | undefined): number {
  return unidadesPorPack(ficha?.ventaMinimaUnidades) ?? 1
}

/** Un nivel de más de una unidad solo se ofrece si son unidades en múltiplo del pack (sin pack, siempre). */
export function esMultiploDelPack(unidades: number, paso: number): boolean {
  return paso <= 1 || unidades % paso === 0
}

/**
 * LA regla de niveles de venta y compra, de menor a mayor, con las unidades de cada uno. No hay nivel
 * Pack: el pack es el paso de Unidad. Bulto solo si trae más de una unidad y es múltiplo del pack;
 * Bulto madre si está cargado, se cuenta en UNIDADES (bulto × bultos por madre) y es múltiplo del pack.
 */
export function nivelesDeEmpaque(ficha: EmpaqueProducto | null | undefined): { unidad: UnidadCompra; unidades: number }[] {
  const niveles: { unidad: UnidadCompra; unidades: number }[] = [{ unidad: 'Unidad', unidades: 1 }]
  const paso = pasoDeUnidad(ficha)
  const porBulto = ficha?.bultoContenido && ficha.bultoContenido > 0 ? ficha.bultoContenido : 1
  if (porBulto > 1 && esMultiploDelPack(porBulto, paso)) niveles.push({ unidad: 'Bulto', unidades: porBulto })
  if (ficha?.bultoMadreContenido && ficha.bultoMadreContenido > 0 && esMultiploDelPack(porBulto * ficha.bultoMadreContenido, paso)) {
    niveles.push({ unidad: 'BultoMadre', unidades: porBulto * ficha.bultoMadreContenido })
  }
  return niveles
}

/** Nivel con el que se abre: Bulto si el producto lo ofrece, si no Unidad (como la oferta de venta). */
export function nivelInicial(ficha: EmpaqueProducto | null | undefined): UnidadCompra {
  return nivelesDeEmpaque(ficha).some((n) => n.unidad === 'Bulto') ? 'Bulto' : 'Unidad'
}

/** Una cantidad en unidades, en el mayor nivel cuyo factor la divide (un borrador viejo en Pack se relee así). */
export function nivelDeUnidades(ficha: EmpaqueProducto | null | undefined, unidades: number): { unidad: UnidadCompra; cantidad: number; unidades: number } {
  const nivel = [...nivelesDeEmpaque(ficha)].reverse().find((n) => unidades > 0 && unidades % n.unidades === 0) ?? { unidad: 'Unidad' as const, unidades: 1 }
  return { unidad: nivel.unidad, cantidad: unidades / nivel.unidades, unidades: nivel.unidades }
}

/**
 * Cómo viene el producto, nivel por nivel (mismo texto que `presentacionEmpaque` de la web):
 * `['Pack x8', 'Bulto 36 packs · 288 u.', 'B. madre 10 bultos · 2.880 u.']`.
 */
export function presentacionEmpaque(ficha: EmpaqueProducto | null | undefined): string[] {
  const niveles = nivelesDeEmpaque(ficha)
  const unidadesDe = (u: UnidadCompra) => niveles.find((n) => n.unidad === u)?.unidades ?? null
  const miles = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
  const pack = unidadesPorPack(ficha?.ventaMinimaUnidades)
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
