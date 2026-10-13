import type { components } from '@/libs/api-client/generated/schema'
import { leerNumero } from '@/features/venta-nueva/lib/linea'

/** "7/10/2026" o "07/10/2026" → "2026-10-07" (día argentino, como lo interpreta el servidor). */
export function leerFecha(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return null
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** "2026-10-07" → "07/10/2026", para precargar el campo. */
export function mostrarFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

export interface FormCobro {
  monto: string
  medioPagoId: string | null
  esCheque: boolean
  /** El medio elegido entra a una caja de efectivo: el servidor necesita saber de qué depósito. */
  requiereCaja: boolean
  depositoId: string | null
  referencia: string
  cheque: { numero: string; banco: string; titular: string; emision: string; pago: string }
}

export interface ChequeRecibido {
  numero: string
  banco: string
  titular: string
  fechaEmision: string
  fechaPago: string
  monto: number
}

/**
 * Cuerpo de `POST /Finanzas/pagos/multilinea` con una sola línea. No lleva `tipoCuenta` ni
 * imputaciones: el servidor elige la cuenta de la deuda más vieja e imputa solo (FIFO).
 */
export interface CobroPayload {
  socioComercialId: string
  referencia?: string
  /** Depósito de la caja que recibe el efectivo; con 2+ cajas abiertas el servidor no lo adivina (#699). */
  depositoId?: string
  /**
   * Clave de idempotencia del cobro (forward-system, `RegistrarPagoMultilineaCommand.claveIdempotencia`): una
   * por cobro, la misma en cada reintento. Un servidor anterior la ignora.
   */
  claveIdempotencia?: components['schemas']['RegistrarPagoMultilineaCommand']['claveIdempotencia']
  lineas: { medioPagoId: string; monto: number; chequesRecibidos?: ChequeRecibido[] }[]
}

/**
 * Lo mínimo para no mandar algo que el servidor va a rechazar seguro; el resto lo valida él. Con
 * `claveIdempotencia`, el cuerpo la lleva: la misma clave en cada reintento del mismo cobro.
 */
export function armarCobro(socioId: string, f: FormCobro, claveIdempotencia?: string): { payload: CobroPayload } | { error: string } {
  const monto = leerNumero(f.monto)
  if (monto === null || monto <= 0) return { error: 'Ingresá el monto del cobro.' }
  if (!f.medioPagoId) return { error: 'Elegí el medio de pago.' }
  const referencia = f.referencia.trim() || undefined
  const caja = f.requiereCaja && f.depositoId ? { depositoId: f.depositoId } : {}
  const clave = claveIdempotencia ? { claveIdempotencia } : {}
  if (!f.esCheque) return { payload: { socioComercialId: socioId, referencia, ...caja, ...clave, lineas: [{ medioPagoId: f.medioPagoId, monto }] } }

  const { numero, banco, titular } = f.cheque
  if (!numero.trim() || !banco.trim() || !titular.trim()) return { error: 'Completá número, banco y titular del cheque.' }
  const fechaEmision = leerFecha(f.cheque.emision)
  const fechaPago = leerFecha(f.cheque.pago)
  if (!fechaEmision || !fechaPago) return { error: 'Las fechas del cheque van como dd/mm/aaaa.' }
  const cheque = { numero: numero.trim(), banco: banco.trim(), titular: titular.trim(), fechaEmision, fechaPago, monto }
  return { payload: { socioComercialId: socioId, referencia, ...caja, ...clave, lineas: [{ medioPagoId: f.medioPagoId, monto, chequesRecibidos: [cheque] }] } }
}
