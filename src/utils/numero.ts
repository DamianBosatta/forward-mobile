/**
 * Número tal como lo tipea el usuario. es-AR: punto de miles, coma decimal ("2.176,50" → 2176.5,
 * "12,82" → 12.82). Como el teclado decimal de Android a veces solo ofrece ".", un único punto
 * seguido de 1 o 2 dígitos es decimal ("12.5", "2176.50"); punto + exactamente 3 dígitos (repetido
 * o no) son miles ("1.500", "12.345.678"). Un separador final ("12," / "12.") se acepta mientras
 * se tipea. Vacío o mal formado ("1,2,3", "1.2.3,4.5", "-5", "abc") → null (inválido).
 */
export function leerNumero(texto: string): number | null {
  const t = texto.trim()
  let normal: string
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d+,\d*$/.test(t)) normal = t.replace(',', '.')
  else if (/^\d+(\.\d{1,2})?\.?$/.test(t) || /^0\.\d+$/.test(t)) normal = t
  else if (/^\d+$/.test(t)) normal = t
  else return null
  const n = Number(normal.replace(/\.$/, ''))
  return Number.isFinite(n) ? n : null
}

/** 12.82 → "12,82" (sin miles: es un campo editable). */
export function mostrarNumero(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** 12.345 → "12,345": precisión completa, para sembrar un campo sin redondear lo que ya guardó el servidor. */
export function numeroCompleto(n: number): string {
  return String(n).replace('.', ',')
}
