/** Quita las tildes y diéresis: "Esencia aromática" → "Esencia aromatica". */
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Forma de comparar en las búsquedas: sin tildes y en minúscula. */
export function normalizarBusqueda(texto: string): string {
  return sinAcentos(texto).toLowerCase()
}

/** Desde esta cantidad de renglones una lista ofrece buscar por nombre (consola del chofer y fragancias). */
export const RENGLONES_PARA_BUSCAR = 8

/**
 * Búsqueda de productos en el teléfono, igual que `CatalogoFiltroBuilder.Busqueda` del servidor:
 * la consulta se parte en palabras, cada palabra tiene que aparecer (sin tildes ni mayúsculas) en
 * algún campo, y las palabras se combinan con Y. Consulta vacía: coincide todo.
 */
export function coincidePalabras(campos: ReadonlyArray<string | null | undefined>, consulta: string): boolean {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const normalizados = campos.filter((c): c is string => c != null).map(normalizarBusqueda)
  return palabras.every((p) => normalizados.some((c) => c.includes(p)))
}
