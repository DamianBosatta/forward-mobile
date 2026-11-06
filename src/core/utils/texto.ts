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
