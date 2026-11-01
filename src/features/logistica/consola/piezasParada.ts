import type { ParadaDto } from '@/libs/api-client/types'

/**
 * Piezas de una parada. Hoy el servidor solo manda la cantidad (`cantidadBultos`, el recuento de
 * paquetes del pedido): las etiquetas por pieza no existen en la API.
 * TODO API (D12): piezas por parada con su etiqueta; hasta entonces `etiquetas` es `null` y la
 * consola no ofrece escanear (la lista manual sigue funcionando).
 */
export interface PiezasParada {
  total: number
  /** Una etiqueta por pieza, en orden; `null` mientras el servidor no las mande. */
  etiquetas: string[] | null
  /** Número de cada bulto armado, en orden (lista informativa, sin escaneo); vacío si la venta no se armó. */
  numeros: number[]
}

// TODO API: reemplazar por el campo de piezas de la parada cuando exista.
export function piezasDeParada(p: Pick<ParadaDto, 'cantidadBultos'> & { bultos?: ParadaDto['bultos'] | null }): PiezasParada {
  const cantidad = Number.isFinite(p.cantidadBultos) ? Math.max(0, Math.trunc(p.cantidadBultos)) : 0
  const numeros = (p.bultos ?? []).map((b) => b.numero)
  return { total: Math.max(cantidad, numeros.length), etiquetas: null, numeros }
}

/** "1 pieza" / "3 piezas". El término de logística es "piezas", nunca "bultos" (S8). */
export const textoPiezas = (n: number): string => `${n} ${n === 1 ? 'pieza' : 'piezas'}`

/** "Pieza 2 de 3 · #A-4822"; sin etiqueta, "Pieza 2 de 3". */
export const tituloPieza = (indice: number, total: number, etiqueta?: string | null): string =>
  `Pieza ${indice + 1} de ${total}${etiqueta ? ` · ${etiqueta}` : ''}`

export type LecturaEtiqueta = { tipo: 'leida'; indice: number } | { tipo: 'repetida'; indice: number } | { tipo: 'ajena' }

/** Qué pasó al leer un código: marca la pieza, ya estaba marcada, o la etiqueta no es de esta parada. */
export function leerEtiqueta(etiquetas: string[], marcadas: ReadonlySet<number>, codigo: string): LecturaEtiqueta {
  const limpio = codigo.trim().toLowerCase()
  const indice = etiquetas.findIndex((e) => e.trim().toLowerCase() === limpio)
  if (indice < 0) return { tipo: 'ajena' }
  return marcadas.has(indice) ? { tipo: 'repetida', indice } : { tipo: 'leida', indice }
}
