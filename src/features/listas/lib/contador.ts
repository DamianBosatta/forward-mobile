/**
 * Contador y total de las listas paginadas.
 *
 * El total (`totalCount`) lo calcula el servidor sobre TODO el filtro; mobile solo
 * muestra cuántos ítems tiene cargados. Nunca se suma nada sobre las páginas
 * cargadas: una suma parcial da un número que parece cierto y está mal.
 */

type Pagina = {
  items?: unknown[]
  totalCount?: number
  data?: { items?: unknown[]; totalCount?: number }
}

/** Ítems de todas las páginas cargadas, en orden. */
export function itemsCargados<T>(pages: Pagina[] | undefined): T[] {
  return (pages ?? []).flatMap(p => (p?.data?.items ?? p?.items ?? []) as T[])
}

/** `totalCount` del servidor (el de la última página, el más reciente), o undefined si no llegó. */
export function totalDelServidor(pages: Pagina[] | undefined): number | undefined {
  if (!pages || pages.length === 0) return undefined
  const ultima = pages[pages.length - 1]
  const total = ultima?.data?.totalCount ?? ultima?.totalCount
  return typeof total === 'number' ? total : undefined
}

/**
 * "Mostrando N de M", con " · $ X" si llega el importe del filtro (ya formateado, del resumen del
 * servidor); null mientras el servidor no informó el total.
 */
export function textoContador(cargados: number, total: number | undefined, importe?: string | null): string | null {
  if (total === undefined) return null
  return importe ? `Mostrando ${cargados} de ${total} · ${importe}` : `Mostrando ${cargados} de ${total}`
}
