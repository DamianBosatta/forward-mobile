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
  lineas: { medioPagoId: string; monto: number; chequesRecibidos?: ChequeRecibido[] }[]
}

/** Lo mínimo para no mandar algo que el servidor va a rechazar seguro; el resto lo valida él. */
export function armarCobro(socioId: string, f: FormCobro): { payload: CobroPayload } | { error: string } {
  const monto = leerNumero(f.monto)
  if (monto === null || monto <= 0) return { error: 'Ingresá el monto del cobro.' }
  if (!f.medioPagoId) return { error: 'Elegí el medio de pago.' }
  const referencia = f.referencia.trim() || undefined
  if (!f.esCheque) return { payload: { socioComercialId: socioId, referencia, lineas: [{ medioPagoId: f.medioPagoId, monto }] } }

  const { numero, banco, titular } = f.cheque
  if (!numero.trim() || !banco.trim() || !titular.trim()) return { error: 'Completá número, banco y titular del cheque.' }
  const fechaEmision = leerFecha(f.cheque.emision)
  const fechaPago = leerFecha(f.cheque.pago)
  if (!fechaEmision || !fechaPago) return { error: 'Las fechas del cheque van como dd/mm/aaaa.' }
  const cheque = { numero: numero.trim(), banco: banco.trim(), titular: titular.trim(), fechaEmision, fechaPago, monto }
  return { payload: { socioComercialId: socioId, referencia, lineas: [{ medioPagoId: f.medioPagoId, monto, chequesRecibidos: [cheque] }] } }
}
