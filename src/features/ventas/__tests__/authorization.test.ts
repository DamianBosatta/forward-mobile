/**
 * PR-2e-b — Authorization flow pure-logic tests.
 *
 * Covers:
 *   1. canAuthorizeVenta(estado, permissions) — combines estado gate + CAP_AUTORIZAR_VENTA
 *   2. buildAutorizarPayload(...) — verifies only ventaId, version, and razon are sent
 *      (usuarioId and isAdminUser removed; server derives identity/role from the JWT token)
 *   3. PendienteAutorizacion chip label — getVentaStatusConfig maps estado '9' to 'Por Autorizar'
 */

import { canAuthorizeVenta, buildAutorizarPayload } from '../lib/authorization'
import { getVentaStatusConfig } from '@/core/constants/status'

// ─────────────────────────────────────────────────────────────────────────────
// canAuthorizeVenta — state + CAP_AUTORIZAR_VENTA gate
// Antes colgaba de canViewCost(roles). Autorizar no es ver costos: el backend contesta 403
// chequeando CAP_AUTORIZAR_VENTA, y la web gatea con canAutorizarVenta(permissions).
// ─────────────────────────────────────────────────────────────────────────────

describe('canAuthorizeVenta — estado + CAP_AUTORIZAR_VENTA', () => {
  const conCapacidad = [{ module: 'CAP_AUTORIZAR_VENTA', canRead: true }]
  const soloCostos = [{ module: 'CAP_VER_COSTOS', canRead: true }]
  const soloModulos = [{ module: 'MOD_VENTAS', canRead: true, canUpdate: true }]

  it('returns true with the capability and estado "9"', () => {
    expect(canAuthorizeVenta('9', conCapacidad)).toBe(true)
  })

  it('returns true with the capability and estado "PendienteAutorizacion" (string variant)', () => {
    expect(canAuthorizeVenta('PendienteAutorizacion', conCapacidad)).toBe(true)
  })

  it('returns false without the capability, even with MOD_VENTAS update', () => {
    expect(canAuthorizeVenta('9', soloModulos)).toBe(false)
  })

  it('CAP_VER_COSTOS alone does NOT authorize (seeing costs is not authorizing)', () => {
    expect(canAuthorizeVenta('9', soloCostos)).toBe(false)
  })

  it('returns false for empty / missing permissions', () => {
    expect(canAuthorizeVenta('9', [])).toBe(false)
    expect(canAuthorizeVenta('9', undefined)).toBe(false)
  })

  it('returns false with the capability but estado "2" (Confirmada)', () => {
    expect(canAuthorizeVenta('2', conCapacidad)).toBe(false)
  })

  it('returns false with the capability but estado "1" (Pendiente)', () => {
    expect(canAuthorizeVenta('1', conCapacidad)).toBe(false)
  })

  it('returns false with the capability but estado "8" (Anulada)', () => {
    expect(canAuthorizeVenta('8', conCapacidad)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildAutorizarPayload — server derives actor/role from token; only razon sent
// ─────────────────────────────────────────────────────────────────────────────

describe('buildAutorizarPayload — includes ventaId, version, and razon only', () => {
  const base = {
    ventaId: 'venta-123',
    version: 5,
    razon: 'Cliente estratégico, cierre de stock',
  }

  it('sin razón (o en blanco) la manda en null: el servidor rechaza una razón vacía', () => {
    expect(buildAutorizarPayload({ ventaId: 'v', version: 1, razon: '   ' }).razon).toBeNull()
    expect(buildAutorizarPayload({ ventaId: 'v', version: 1 }).razon).toBeNull()
  })

  it('includes razon in the payload', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload.razon).toBe('Cliente estratégico, cierre de stock')
  })

  it('includes ventaId and version', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload.ventaId).toBe('venta-123')
    expect(payload.version).toBe(5)
  })

  it('does NOT include usuarioId (server derives identity from the JWT token)', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload).not.toHaveProperty('usuarioId')
  })

  it('does NOT include isAdminUser (server derives role from the JWT token)', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload).not.toHaveProperty('isAdminUser')
  })

  it('trims whitespace from razon', () => {
    const payload = buildAutorizarPayload({ ...base, razon: '  acuerdo comercial  ' })
    expect(payload.razon).toBe('acuerdo comercial')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PendienteAutorizacion chip label — getVentaStatusConfig maps '9' → 'Por Autorizar'
// ─────────────────────────────────────────────────────────────────────────────

describe('getVentaStatusConfig — PendienteAutorizacion label for filter chip', () => {
  // colors stub (only danger needed, but pass a minimal object)
  const colors = { danger: '#ef4444', primary: '#00b4a2', textMuted: '#94a3b8', surface2: '#f1f5f9' }

  it('returns label "Por Autorizar" for estado "9"', () => {
    const config = getVentaStatusConfig('9', colors)
    expect(config.label).toBe('Por Autorizar')
  })

  it('returns label "Por Autorizar" for estado "PendienteAutorizacion" string', () => {
    const config = getVentaStatusConfig('PendienteAutorizacion', colors)
    // The backend serializes EstadoVenta as the string-enum name 'PendienteAutorizacion'
    // via JsonStringEnumConverter. getVentaStatusConfig must match both '9' and
    // 'PendienteAutorizacion' so the "Por Autorizar" filter chip works correctly.
    expect(config.label).toBe('Por Autorizar')
  })

  it('filter predicate keeps a PendienteAutorizacion row when chip is "Por Autorizar"', () => {
    // End-to-end proof: the same filter logic used in useVentasList.filteredVentas
    const row = { estado: 'PendienteAutorizacion' } as any
    const kept = getVentaStatusConfig(row.estado, colors).label === 'Por Autorizar'
    expect(kept).toBe(true)
  })

  it('returns danger color for estado "9"', () => {
    const config = getVentaStatusConfig('9', colors)
    expect(config.color).toBe(colors.danger)
  })
})
