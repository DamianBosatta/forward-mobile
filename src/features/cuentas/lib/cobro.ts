import { leerNumero } from '@/features/venta-nueva/lib/linea'

export interface FormCobro {
  monto: string
  medioPagoId: string | null
  referencia: string
}

/**
 * Cuerpo de `POST /Finanzas/pagos/multilinea` con una sola línea. No lleva `tipoCuenta` ni
 * imputaciones: el servidor elige la cuenta de la deuda más vieja e imputa solo (FIFO).
 */
export interface CobroPayload {
  socioComercialId: string
  referencia?: string
  lineas: { medioPagoId: string; monto: number }[]
}

/** Lo mínimo para no mandar algo que el servidor va a rechazar seguro; el resto lo valida él. */
export function armarCobro(socioId: string, f: FormCobro): { payload: CobroPayload } | { error: string } {
  const monto = leerNumero(f.monto)
  if (monto === null || monto <= 0) return { error: 'Ingresá el monto del cobro.' }
  if (!f.medioPagoId) return { error: 'Elegí el medio de pago.' }
  const referencia = f.referencia.trim() || undefined
  return { payload: { socioComercialId: socioId, referencia, lineas: [{ medioPagoId: f.medioPagoId, monto }] } }
}
