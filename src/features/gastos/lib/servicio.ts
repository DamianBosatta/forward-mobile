import type { components } from '@/libs/api-client/generated/schema'
import { leerNumero } from '@/features/venta-nueva/lib/linea'

export type GastoPayload = components['schemas']['RegistrarGastoCommand']

export interface FormServicio {
  monto: string
  tipoGastoId: string | null
  descripcion: string
  medioPagoId: string | null
  /** El medio elegido sale de la caja (efectivo): no lleva cuenta de origen. */
  requiereCaja: boolean
  cuentaOrigenId: string | null
  comprobanteUrl: string | null
}

/** Qué falta para registrar el pago (misma regla que el servidor: monto > 0, concepto, medio y, sin caja, cuenta). */
export function validarServicio(f: FormServicio): string | null {
  const n = leerNumero(f.monto)
  if (n === null || n <= 0) return 'Ingresá el monto.'
  if (!f.tipoGastoId) return 'Elegí el concepto.'
  if (!f.medioPagoId) return 'Elegí cómo se pagó.'
  if (!f.requiereCaja && !f.cuentaOrigenId) return 'Elegí la cuenta de origen.'
  return null
}

/** Cuerpo de `POST /gastos`. El servidor exige descripción: sin una escrita va el nombre del concepto. */
export function cuerpoDelGasto(f: FormServicio, nombreConcepto: string): GastoPayload {
  return {
    descripcion: f.descripcion.trim() || nombreConcepto,
    monto: leerNumero(f.monto) ?? 0,
    tipoGastoId: f.tipoGastoId ?? undefined,
    medioPagoId: f.medioPagoId ?? undefined,
    cuentaOrigenId: f.requiereCaja ? null : f.cuentaOrigenId,
    comprobanteUrl: f.comprobanteUrl,
  }
}
