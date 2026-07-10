/**
 * PR-2e-b — Authorization flow pure-logic tests.
 *
 * Covers:
 *   1. canAuthorizeVenta(estado, roles) — combines estado gate + canViewCost gate
 *   2. buildAutorizarPayload(...) — verifies only ventaId, version, and razon are sent
 *      (usuarioId and isAdminUser removed; server derives identity/role from the JWT token)
 *   3. PendienteAutorizacion chip label — getVentaStatusConfig maps estado '9' to 'Por Autorizar'
 */

import { canAuthorizeVenta, buildAutorizarPayload } from '../lib/authorization'
import { getVentaStatusConfig } from '@/core/constants/status'

// ─────────────────────────────────────────────────────────────────────────────
// canAuthorizeVenta — state + role gate
// ─────────────────────────────────────────────────────────────────────────────

describe('canAuthorizeVenta — estado + cost-role gate', () => {
  const costRoles = ['Administrador']
  const managerRoles = ['Gerencia']
  const sysAdminRoles = ['AdministradorSistemas']
  const empleadoRoles = ['Empleado']
  const emptyRoles: string[] = []

  // Cost roles + estado '9' → can authorize
  it('returns true for Administrador with estado "9"', () => {
    expect(canAuthorizeVenta('9', costRoles)).toBe(true)
  })

  it('returns true for Gerencia with estado "9"', () => {
    expect(canAuthorizeVenta('9', managerRoles)).toBe(true)
  })

  it('returns true for AdministradorSistemas with estado "9"', () => {
    expect(canAuthorizeVenta('9', sysAdminRoles)).toBe(true)
  })

  it('returns true for Administrador with estado "PendienteAutorizacion" (string variant)', () => {
    expect(canAuthorizeVenta('PendienteAutorizacion', costRoles)).toBe(true)
  })

  // Non-cost role → cannot authorize even in estado 9
  it('returns false for Empleado with estado "9"', () => {
    expect(canAuthorizeVenta('9', empleadoRoles)).toBe(false)
  })

  it('returns false for empty roles with estado "9"', () => {
    expect(canAuthorizeVenta('9', emptyRoles)).toBe(false)
  })

  // Cost role but wrong estado → cannot authorize
  it('returns false for Administrador with estado "2" (Confirmada)', () => {
    expect(canAuthorizeVenta('2', costRoles)).toBe(false)
  })

  it('returns false for Administrador with estado "1" (Pendiente)', () => {
    expect(canAuthorizeVenta('1', costRoles)).toBe(false)
  })

  it('returns false for Administrador with estado "8" (Anulada)', () => {
    expect(canAuthorizeVenta('8', costRoles)).toBe(false)
  })

  // Numeric estado as string
  it('returns true for Gerencia with numeric-string estado "9"', () => {
    expect(canAuthorizeVenta('9', managerRoles)).toBe(true)
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
