import type { RegistrarPagoMultilineaCommand } from '@/libs/api-client/types'
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
  /** Cuenta propia donde entró la transferencia o el depósito; null = la del medio (la decide el servidor). */
  cuentaPropiaId: string | null
  /** URL del comprobante ya subido (`POST /Media/upload-comprobante`). */
  comprobanteUrl: string | null
  /** URL de la foto del cheque ya subida (`POST /Media/upload-cheque`). */
  chequeFotoUrl: string | null
  /** Imputación manual: id del comprobante → monto tipeado, en el orden en que se eligieron. Null = automática. */
  imputaciones: Record<string, string> | null
}

export interface ChequeRecibido {
  numero: string
  banco: string
  titular: string
  fechaEmision: string
  fechaPago: string
  monto: number
  imagenUrl?: string
}

export interface ImputacionCobro {
  documentoId: string
  monto: number
}

interface LineaCobro {
  medioPagoId: string
  monto: number
  cuentaPropiaId?: string
  chequesRecibidos?: ChequeRecibido[]
}

/**
 * Cuerpo de `POST /Finanzas/pagos/multilinea` con una sola línea. No lleva `tipoCuenta`: sin
 * `imputaciones`, el servidor elige la cuenta de la deuda más vieja e imputa solo (FIFO); con ellas,
 * usa la cuenta de los comprobantes elegidos.
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
  claveIdempotencia?: RegistrarPagoMultilineaCommand['claveIdempotencia']
  comprobanteUrl?: string
  imputaciones?: ImputacionCobro[]
  lineas: LineaCobro[]
}

export const SIN_COMPROBANTES = 'Elegí al menos un comprobante o volvé a la imputación automática.'
export const MONTO_IMPUTADO_INVALIDO = 'Revisá el monto a imputar de cada comprobante.'
export const IMPUTADO_DE_MAS = 'Lo imputado no puede superar el monto del cobro.'

/** Las imputaciones manuales elegidas; `undefined` con la automática. Cuánto se puede imputar a cada uno lo valida el servidor. */
function armarImputaciones(elegidas: FormCobro['imputaciones'], total: number): { imputaciones?: ImputacionCobro[] } | { error: string } {
  if (!elegidas) return {}
  const items = Object.entries(elegidas).map(([documentoId, texto]) => ({ documentoId, monto: leerNumero(texto) }))
  if (items.length === 0) return { error: SIN_COMPROBANTES }
  const imputaciones = items.flatMap(i => (i.monto !== null && i.monto > 0 ? [{ documentoId: i.documentoId, monto: i.monto }] : []))
  if (imputaciones.length !== items.length) return { error: MONTO_IMPUTADO_INVALIDO }
  const suma = imputaciones.reduce((s, i) => s + i.monto, 0)
  if (suma > total + 0.005) return { error: IMPUTADO_DE_MAS }
  return { imputaciones }
}

function armarCheque(f: FormCobro, monto: number): { cheque: ChequeRecibido } | { error: string } {
  const { numero, banco, titular } = f.cheque
  if (!numero.trim() || !banco.trim() || !titular.trim()) return { error: 'Completá número, banco y titular del cheque.' }
  const fechaEmision = leerFecha(f.cheque.emision)
  const fechaPago = leerFecha(f.cheque.pago)
  if (!fechaEmision || !fechaPago) return { error: 'Las fechas del cheque van como dd/mm/aaaa.' }
  const foto = f.chequeFotoUrl ? { imagenUrl: f.chequeFotoUrl } : {}
  return { cheque: { numero: numero.trim(), banco: banco.trim(), titular: titular.trim(), fechaEmision, fechaPago, monto, ...foto } }
}

/** La cuenta propia solo vale para un medio que no entra a caja ni es cheque (el servidor la ignora en los demás). */
const vaACuentaPropia = (f: FormCobro) => !!f.cuentaPropiaId && !f.requiereCaja && !f.esCheque

/**
 * Lo mínimo para no mandar algo que el servidor va a rechazar seguro; el resto lo valida él. Con
 * `claveIdempotencia`, el cuerpo la lleva: la misma clave en cada reintento del mismo cobro.
 */
export function armarCobro(socioId: string, f: FormCobro, claveIdempotencia?: string): { payload: CobroPayload } | { error: string } {
  const monto = leerNumero(f.monto)
  if (monto === null || monto <= 0) return { error: 'Ingresá el monto del cobro.' }
  if (!f.medioPagoId) return { error: 'Elegí el medio de pago.' }
  const imputacion = armarImputaciones(f.imputaciones, monto)
  if ('error' in imputacion) return imputacion
  const cheque = f.esCheque ? armarCheque(f, monto) : null
  if (cheque && 'error' in cheque) return cheque

  const linea: LineaCobro = {
    medioPagoId: f.medioPagoId,
    monto,
    ...(vaACuentaPropia(f) ? { cuentaPropiaId: f.cuentaPropiaId! } : {}),
    ...(cheque ? { chequesRecibidos: [cheque.cheque] } : {}),
  }
  return {
    payload: {
      socioComercialId: socioId,
      referencia: f.referencia.trim() || undefined,
      ...(f.requiereCaja && f.depositoId ? { depositoId: f.depositoId } : {}),
      ...(claveIdempotencia ? { claveIdempotencia } : {}),
      ...(f.comprobanteUrl ? { comprobanteUrl: f.comprobanteUrl } : {}),
      ...imputacion,
      lineas: [linea],
    },
  }
}
