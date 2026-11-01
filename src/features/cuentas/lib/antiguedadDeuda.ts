/** Más de estos días la deuda más vieja se dice "Vencida" (lámina cuentas-lista). */
export const DIAS_DEUDA_VENCIDA = 30

export interface ChipAntiguedadDeuda {
  /** `peligro`: vencida (más de 30 días); `aviso`: deuda reciente. */
  tono: 'peligro' | 'aviso'
  texto: string
}

/**
 * Chip de antigüedad de la deuda más vieja de una fila de "Me deben / Debo" (`diasDeudaMasVieja` del servidor).
 * null/undefined = sin deuda pendiente o dato no informado: sin chip. 0 días: sin chip (no hay antigüedad que decir;
 * el servidor lo manda como 0 cuando la deuda es de hoy).
 */
export function chipAntiguedadDeuda(dias: number | null | undefined): ChipAntiguedadDeuda | null {
  if (dias == null || !(dias >= 1)) return null
  const n = Math.floor(dias)
  const unidad = n === 1 ? 'día' : 'días'
  return n > DIAS_DEUDA_VENCIDA
    ? { tono: 'peligro', texto: `Vencida · ${n} ${unidad}` }
    : { tono: 'aviso', texto: `Deuda de ${n} ${unidad}` }
}
