import { esEstadoVenta } from '@/core/constants/estados'
import { ESTADO_VENTA } from '@/libs/reglas/estados'

/**
 * pedido-pdf-gating.ts
 *
 * Pure, side-effect-free helpers for estado-based PDF action gating.
 * The API sends EstadoVenta as a name, a number or a numeric string depending on the endpoint;
 * esEstadoVenta (libs/reglas/estados) resolves all three.
 *
 * Gating rules (authoritative — see spec S4-B1):
 *   Etiquetas    → available from Empacada (4) onward
 *   NotaEntrega  → available from EnPreparacion (3) onward
 *   Anulada (8)  → neither (treated as terminal / cancelled)
 */

/** Valor numérico en texto de cada estado, de la tabla compartida (lo usan los tests). */
export const ESTADO_VENTA_NUMERIC = {
  PENDIENTE: String(ESTADO_VENTA.Pendiente.valor),
  CONFIRMADA: String(ESTADO_VENTA.Confirmada.valor),
  EN_PREPARACION: String(ESTADO_VENTA.EnPreparacion.valor),
  EMPACADA: String(ESTADO_VENTA.Empacada.valor),
  EN_RUTA: String(ESTADO_VENTA.EnRuta.valor),
  ENTREGADA: String(ESTADO_VENTA.Entregada.valor),
  NO_ENTREGADA: String(ESTADO_VENTA.NoEntregada.valor),
  ANULADA: String(ESTADO_VENTA.Anulada.valor),
  PENDIENTE_AUTORIZACION: String(ESTADO_VENTA.PendienteAutorizacion.valor),
} as const

/**
 * Returns true when the Etiquetas PDF action should be available.
 * Empacada (4), EnRuta (5), Entregada (6), NoEntregada (7).
 */
export function canDownloadEtiquetas(estado: string | number): boolean {
  return esEstadoVenta(estado, 'Empacada', 'EnRuta', 'Entregada', 'NoEntregada')
}

/**
 * Returns true when the Nota de Entrega PDF action should be available.
 * EnPreparacion (3), Empacada (4), EnRuta (5), Entregada (6), NoEntregada (7).
 */
export function canDownloadNotaEntrega(estado: string | number): boolean {
  return esEstadoVenta(estado, 'EnPreparacion', 'Empacada', 'EnRuta', 'Entregada', 'NoEntregada')
}
