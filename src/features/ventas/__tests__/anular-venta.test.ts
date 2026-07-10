/**
 * Tests for the anular-venta payload builder (mobile).
 *
 * BUG CONTEXT (Sentry 400):
 *   useAnularVenta previously called:
 *     api.delete(`/api/v1/Ventas/${id}`, { data: { version, motivoAnulacion, usuarioModificadorId } })
 *   The mobile custom client's delete signature is (endpoint, body?) — the body IS
 *   the second argument, sent directly. Wrapping it in { data: {...} } (axios syntax)
 *   caused the server to receive { "data": { ... } }, deserialized MotivoAnulacion as ""
 *   → FluentValidation NotEmpty → HTTP 400.
 *
 * FIX:
 *   api.delete(`/api/v1/Ventas/${id}`, { version, motivoAnulacion })
 *   Drop usuarioModificadorId — server derives identity from JWT.
 *
 * NOTE ON HOOK TESTS:
 *   useAnularVenta lives in libs/api-client/ventas.ts and depends on @tanstack/react-query
 *   + the custom fetch client. Rendering it with renderHook in jest-expo requires a
 *   QueryClientProvider and native-module shims that are not available in this codebase's
 *   jest setup (consistent with the rest of the ventas tests). The accepted approach is to
 *   extract and test the pure payload-building logic instead.
 */

import { buildAnularVentaPayload } from '../lib/anular-venta'

describe('buildAnularVentaPayload', () => {
  it('returns { version, motivoAnulacion } with no extra fields', () => {
    const payload = buildAnularVentaPayload(3, 'Cancelación manual')
    expect(payload).toEqual({ version: 3, motivoAnulacion: 'Cancelación manual' })
  })

  it('does NOT include usuarioModificadorId in the payload', () => {
    const payload = buildAnularVentaPayload(0, 'Cancelación manual')
    expect(payload).not.toHaveProperty('usuarioModificadorId')
  })

  it('does NOT wrap the payload in a "data" key (not axios syntax)', () => {
    const payload = buildAnularVentaPayload(1, 'Prueba')
    expect(payload).not.toHaveProperty('data')
  })

  it('accepts version 0 (uint — first save)', () => {
    const payload = buildAnularVentaPayload(0, 'Motivo')
    expect(payload.version).toBe(0)
  })

  it('preserves motivoAnulacion exactly', () => {
    const payload = buildAnularVentaPayload(5, 'Error de carga')
    expect(payload.motivoAnulacion).toBe('Error de carga')
  })

  it('throws if motivoAnulacion is empty', () => {
    expect(() => buildAnularVentaPayload(1, '')).toThrow('motivoAnulacion must be a non-empty string')
  })

  it('throws if motivoAnulacion is whitespace only', () => {
    expect(() => buildAnularVentaPayload(1, '   ')).toThrow('motivoAnulacion must be a non-empty string')
  })

  it('throws if version is negative', () => {
    expect(() => buildAnularVentaPayload(-1, 'Motivo')).toThrow('version must be a non-negative number')
  })
})
