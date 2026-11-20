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

const PREFIJOS_DE_CALLE = /^(calle|av\.?|avda\.?|avenida|pasaje|pje\.?|psje\.?|ruta|rta\.?|bv\.?|bvd\.?|boulevard|bulevar|diagonal|diag\.?|camino|cno\.?)$/i

/**
 * Dos letras para un avatar, de una dirección o un nombre: "Brandsen 3314" → "B3", "Juan Pérez" → "JP".
 * Salta el prefijo de calle (Calle, Av., Avenida, Pasaje, Avda., Pje., Ruta, Bv., Boulevard, Diagonal, Diag., Camino): "Calle 1 234" → "12".
 * Es la única regla de iniciales de la app (X1).
 */
export function iniciales(texto: string): string {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const sinPrefijo = palabras.length > 1 && PREFIJOS_DE_CALLE.test(sinAcentos(palabras[0]!)) ? palabras.slice(1) : palabras
  return sinPrefijo.slice(0, 2).map((p) => p[0]!).join('').toUpperCase()
}
