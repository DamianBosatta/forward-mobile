/**
 * Input masks for text fields that use a digits-only keyboard (Android has no "/" or ":" on it).
 * Both keep only digits and insert the separators while typing.
 */

/** "01022026" → "01/02/2026" */
export function enmascararFecha(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** "0930" → "09:30" */
export function enmascararHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}
