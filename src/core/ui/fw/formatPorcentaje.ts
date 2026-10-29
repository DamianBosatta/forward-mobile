/** "26,7 %"; sin dato, "—" (un margen que no llegó no es 0). */
export function formatPorcentaje(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : `${valor.toFixed(1).replace('.', ',')} %`
}
