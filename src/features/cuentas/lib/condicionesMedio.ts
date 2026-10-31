import type { MedioDePago } from '../api/cobros'

export interface CondicionesMedio {
  /** Porcentaje de comisión del medio (0 si no cobra). */
  comisionPorcentaje: number
  /** Comisión sobre el monto; null sin monto cargado. */
  comision: number | null
  /** Monto menos comisión; null sin monto cargado. */
  neto: number | null
  /** Días hasta que el medio acredita (0 = en el momento). */
  diasAcreditacion: number
}

const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * Lo que el medio de pago le descuenta o le demora al cobro, solo para informar (`MedioPagoResponse`): el monto
 * que se manda al servidor es el que cargó la persona, nunca el neto. null si el medio no cobra comisión ni demora.
 */
export function condicionesDelMedio(medio: Pick<MedioDePago, 'comisionPorcentaje' | 'diasAcreditacion'> | undefined, monto: number | null): CondicionesMedio | null {
  const pct = medio?.comisionPorcentaje ?? 0
  const dias = medio?.diasAcreditacion ?? 0
  if (!(pct > 0) && !(dias > 0)) return null
  const comision = monto != null && monto > 0 ? centavos((monto * pct) / 100) : null
  return { comisionPorcentaje: pct, comision, neto: comision == null || monto == null ? null : centavos(monto - comision), diasAcreditacion: dias }
}
