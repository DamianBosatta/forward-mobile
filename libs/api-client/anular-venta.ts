/**
 * Pure helpers for the "anular venta" (cancel sale) flow.
 *
 * Lives in libs/api-client so it is imported by both:
 * - libs/api-client/ventas.ts (the mobile hook)
 * - src/features/ventas/__tests__/anular-venta.test.ts (the test)
 *
 * This ensures the tests guard the exact code path that ships.
 */

export interface AnularVentaPayload {
  version: number
  motivoAnulacion: string
}

/**
 * Build the request body for `DELETE /api/v1/Ventas/{id}`.
 *
 * Rules:
 * - `version` must be >= 0 (uint — optimistic concurrency token).
 * - `motivoAnulacion` must be a non-empty string.
 * - `usuarioModificadorId` must NOT be included (server derives identity from JWT).
 */
export function buildAnularVentaPayload(
  version: number,
  motivoAnulacion: string,
): AnularVentaPayload {
  if (typeof version !== 'number' || version < 0) {
    throw new Error('version must be a non-negative number')
  }
  if (!motivoAnulacion || !motivoAnulacion.trim()) {
    throw new Error('motivoAnulacion must be a non-empty string')
  }
  return { version, motivoAnulacion }
}
