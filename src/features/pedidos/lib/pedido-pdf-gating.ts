/**
 * pedido-pdf-gating.ts
 *
 * Pure, side-effect-free helpers for estado-based PDF action gating.
 * The API returns EstadoVenta as a numeric string (mirrors VENTA_ESTADOS
 * in src/core/constants/status.ts). Both string and number inputs are
 * coerced so the helper is data-source-agnostic.
 *
 * Gating rules (authoritative — see spec S4-B1):
 *   Etiquetas    → available from Empacada (4) onward
 *   NotaEntrega  → available from EnPreparacion (3) onward
 *   Anulada (8)  → neither (treated as terminal / cancelled)
 */

// Mirrored from VENTA_ESTADOS (src/core/constants/status.ts) and confirmed
// against generated schema.ts EstadoVenta enum order.
export const ESTADO_VENTA_NUMERIC = {
  PENDIENTE: '1',
  CONFIRMADA: '2',
  EN_PREPARACION: '3',
  EMPACADA: '4',
  EN_RUTA: '5',
  ENTREGADA: '6',
  NO_ENTREGADA: '7',
  ANULADA: '8',
  PENDIENTE_AUTORIZACION: '9',
} as const

const ETIQUETAS_ESTADOS: ReadonlySet<string> = new Set([
  ESTADO_VENTA_NUMERIC.EMPACADA,
  ESTADO_VENTA_NUMERIC.EN_RUTA,
  ESTADO_VENTA_NUMERIC.ENTREGADA,
  ESTADO_VENTA_NUMERIC.NO_ENTREGADA,
])

const NOTA_ENTREGA_ESTADOS: ReadonlySet<string> = new Set([
  ESTADO_VENTA_NUMERIC.EN_PREPARACION,
  ESTADO_VENTA_NUMERIC.EMPACADA,
  ESTADO_VENTA_NUMERIC.EN_RUTA,
  ESTADO_VENTA_NUMERIC.ENTREGADA,
  ESTADO_VENTA_NUMERIC.NO_ENTREGADA,
])

/**
 * Returns true when the Etiquetas PDF action should be available.
 * Empacada (4), EnRuta (5), Entregada (6), NoEntregada (7).
 */
export function canDownloadEtiquetas(estado: string | number): boolean {
  return ETIQUETAS_ESTADOS.has(String(estado))
}

/**
 * Returns true when the Nota de Entrega PDF action should be available.
 * EnPreparacion (3), Empacada (4), EnRuta (5), Entregada (6), NoEntregada (7).
 */
export function canDownloadNotaEntrega(estado: string | number): boolean {
  return NOTA_ENTREGA_ESTADOS.has(String(estado))
}
