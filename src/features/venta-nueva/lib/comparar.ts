/**
 * Forma canónica de un borrador para compararlo con lo que devuelve el servidor: el GET del detalle
 * no garantiza el orden de las líneas y puede normalizar decimales. Los números se redondean a 2
 * decimales, las claves se ordenan, null/undefined/omitido son lo mismo y las listas no dependen
 * del orden (se ordenan por su propia forma canónica: productoId, cantidad, precio...).
 */
function canonico(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 100) / 100
  if (Array.isArray(v)) return v.map(canonico).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0))
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(o).sort().filter((k) => o[k] !== null && o[k] !== undefined).map((k) => [k, canonico(o[k])]),
    )
  }
  return v
}

export const claveCanonica = (v: unknown): string => JSON.stringify(canonico(v))

export const mismoContenido = (a: unknown, b: unknown): boolean => claveCanonica(a) === claveCanonica(b)
