/**
 * Tests for the anular-compra payload builder (mobile).
 *
 * BUG CONTEXT (HTTP 400):
 *   useCancelarCompra previously called:
 *     api.delete(`/api/v1/Compras/${id}/anular`, { MotivoCancelacion: motivo })
 *   Two bugs combined:
 *   1. Wrong field name: Pascal-case `MotivoCancelacion` instead of camelCase `motivoAnulacion`
 *      (which maps to the backend's `MotivoAnulacion`). The server received null/empty →
 *      FluentValidation NotEmpty → HTTP 400.
 *   2. CancelCompraCommandValidator also required UsuarioGeneradorId to be non-empty, but
 *      mobile never sent it — that rule has now been removed (server uses token instead).
 *
 * FIX:
 *   api.delete(`/api/v1/Compras/${id}/anular`, buildAnularCompraPayload(motivo))
 *   Correct field name: motivoAnulacion. No usuarioGeneradorId — server derives from JWT.
 *
 * NOTE ON HOOK TESTS:
 *   useCancelarCompra lives in libs/api-client/compras.ts and depends on @tanstack/react-query
 *   + the custom fetch client. Rendering it with renderHook in jest-expo requires a
 *   QueryClientProvider and native-module shims not available in this codebase's jest setup
 *   (consistent with the rest of the compras tests). The accepted approach is to extract and
 *   test the pure payload-building logic instead.
 */

import { buildAnularCompraPayload } from '../lib/anular-compra'

describe('buildAnularCompraPayload', () => {
  it('returns { motivoAnulacion } with no extra fields', () => {
    const payload = buildAnularCompraPayload('Cancelación manual')
    expect(payload).toEqual({ motivoAnulacion: 'Cancelación manual' })
  })

  it('does NOT include usuarioGeneradorId in the payload', () => {
    const payload = buildAnularCompraPayload('Cancelación manual')
    expect(payload).not.toHaveProperty('usuarioGeneradorId')
  })

  it('does NOT use the wrong key MotivoCancelacion (was the mobile bug)', () => {
    const payload = buildAnularCompraPayload('Cancelación manual')
    expect(payload).not.toHaveProperty('MotivoCancelacion')
  })

  it('does NOT wrap the payload in a "data" key (not axios syntax)', () => {
    const payload = buildAnularCompraPayload('Cancelación manual')
    expect(payload).not.toHaveProperty('data')
  })

  it('preserves motivoAnulacion exactly', () => {
    const payload = buildAnularCompraPayload('Error de carga')
    expect(payload.motivoAnulacion).toBe('Error de carga')
  })

  it('throws if motivoAnulacion is empty', () => {
    expect(() => buildAnularCompraPayload('')).toThrow('motivoAnulacion must be a non-empty string')
  })

  it('throws if motivoAnulacion is whitespace only', () => {
    expect(() => buildAnularCompraPayload('   ')).toThrow('motivoAnulacion must be a non-empty string')
  })
})
