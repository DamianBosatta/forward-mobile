import type { ChipEstado } from '@/libs/theme'
import type { ParadaDto } from '@/libs/api-client/types'

type TipoCobro = NonNullable<ParadaDto['tipoCobro']>

const CHIP: Record<TipoCobro, { estado: ChipEstado; label: string }> = {
  Contado: { estado: 'porAutorizar', label: 'Cobrar contado' },
  Saldo: { estado: 'porAutorizar', label: 'Cobrar saldo' },
  Pagado: { estado: 'entregado', label: 'Pagado' },
  CuentaCorriente: { estado: 'pendiente', label: 'Cuenta corriente' },
}

/** Chip de cobro de la parada; `null` si el servidor no lo manda (versión anterior) o trae un valor que no conocemos. */
export function chipCobro(p: ParadaDto): { estado: ChipEstado; label: string } | null {
  return p.tipoCobro ? (CHIP[p.tipoCobro] ?? null) : null
}

/**
 * Qué importe y con qué rótulo se muestra la parada. La regla de cobro la decide el servidor: acá solo
 * se muestra. Sin los campos nuevos queda como antes ("Total del pedido" con `montoTotal`).
 */
export function importeParada(p: ParadaDto): { rotulo: string; valor: number; aCobrar: boolean } {
  const cobra = (p.tipoCobro === 'Contado' || p.tipoCobro === 'Saldo') && p.montoCobrar != null
  return cobra
    ? { rotulo: 'A cobrar', valor: p.montoCobrar as number, aCobrar: true }
    : { rotulo: 'Total del pedido', valor: p.montoTotal, aCobrar: false }
}

/** Leyenda de las filas donde no hay nada que cobrar en la calle. */
export function leyendaSinCobro(p: ParadaDto): string | null {
  if (p.tipoCobro === 'Pagado') return 'nada que cobrar'
  if (p.tipoCobro === 'CuentaCorriente') return 'no se cobra'
  return null
}

export const etiquetaNota = (p: ParadaDto): string | null =>
  p.numeroNotaEntrega != null ? `NTE${p.numeroNotaEntrega}` : null
