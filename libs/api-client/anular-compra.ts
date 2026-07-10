/**
 * Pure helpers for the "anular compra" (cancel purchase) flow.
 *
 * Lives in libs/api-client so it is imported by both:
 * - libs/api-client/compras.ts (the mobile hook)
 * - src/features/compras/__tests__/anular-compra.test.ts (the test)
 *
 * This ensures the tests guard the exact code path that ships.
 *
 * BUG CONTEXT (HTTP 400):
 *   useCancelarCompra previously sent { MotivoCancelacion: motivo } — wrong field name (Pascal case,
 *   wrong key). The backend command property is MotivoAnulacion. The server received null/empty for
 *   MotivoAnulacion → CancelCompraCommandValidator NotEmpty → HTTP 400.
 *   Additionally, UsuarioGeneradorId was absent (correct) but the validator also required it
 *   non-empty (that rule has now been removed from the validator).
 *
 * FIX:
 *   Correct field name: motivoAnulacion (camelCase, matches JSON serialization of MotivoAnulacion).
 *   The server derives the actor from the authenticated token — usuarioGeneradorId is NOT sent.
 */

export interface AnularCompraPayload {
  motivoAnulacion: string
}

/**
 * Build the request body for `DELETE /api/v1/Compras/{id}/anular`.
 *
 * Rules:
 * - `motivoAnulacion` must be a non-empty string.
 * - `usuarioGeneradorId` must NOT be included (server derives identity from JWT).
 */
export function buildAnularCompraPayload(motivoAnulacion: string): AnularCompraPayload {
  if (!motivoAnulacion || !motivoAnulacion.trim()) {
    throw new Error('motivoAnulacion must be a non-empty string')
  }
  return { motivoAnulacion }
}
