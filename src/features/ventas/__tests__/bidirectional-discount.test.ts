/**
 * S3b.1 — RED tests for pctFromPrecio, precioFromPct, canViewCost
 * in mobile descuentos.ts
 *
 * These test the bidirectional discount helpers (ADR-5) and the role-based
 * cost-view gate. Tests fail until the functions are added to descuentos.ts.
 */

import { pctFromPrecio, precioFromPct, canViewCost } from '../lib/descuentos'

// ─────────────────────────────────────────────────────────────────────────────
// pctFromPrecio
// ─────────────────────────────────────────────────────────────────────────────

describe('pctFromPrecio', () => {
  it('computes 10% discount correctly', () => {
    // 1000 * (1 - 0.10) = 900 → pct = (1 - 900/1000)*100 = 10
    expect(pctFromPrecio(1000, 900)).toBe(10)
  })

  it('computes 0% when precioFinal equals precioVenta', () => {
    expect(pctFromPrecio(1000, 1000)).toBe(0)
  })

  it('returns 0 when precioVenta is 0 (guard for division by zero)', () => {
    expect(pctFromPrecio(0, 500)).toBe(0)
  })

  it('returns 0 when precioVenta is negative', () => {
    expect(pctFromPrecio(-100, 50)).toBe(0)
  })

  it('rounds pct to 2 decimal places', () => {
    // 1000 * (1 - x/100) = 333.33 → x = (1 - 333.33/1000)*100 = 66.667 → rounds to 66.67
    expect(pctFromPrecio(1000, 333.33)).toBe(66.67)
  })

  it('round-trips with precioFromPct within rounding tolerance', () => {
    // With 2-decimal rounding, round-trip may drift up to ~0.05
    const pct = pctFromPrecio(1000, 876.54)
    const recovered = precioFromPct(1000, pct)
    expect(Math.abs(recovered - 876.54)).toBeLessThanOrEqual(0.05)
  })

  it('handles 100% discount (free item)', () => {
    expect(pctFromPrecio(1000, 0)).toBe(100)
  })

  it('handles a non-integer floor price (sub-cent precision case)', () => {
    // precioMinimo = 857.14 (non-integer)
    // pct = (1 - 857.14 / 1000) * 100 = 14.286 → rounds to 14.29
    expect(pctFromPrecio(1000, 857.14)).toBe(14.29)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// precioFromPct
// ─────────────────────────────────────────────────────────────────────────────

describe('precioFromPct', () => {
  it('computes $900 for 10% discount on $1000 item', () => {
    expect(precioFromPct(1000, 10)).toBe(900)
  })

  it('returns precioVenta unchanged for 0% discount', () => {
    expect(precioFromPct(1000, 0)).toBe(1000)
  })

  it('returns 0 for 100% discount', () => {
    expect(precioFromPct(1000, 100)).toBe(0)
  })

  it('rounds price to 2 decimal places', () => {
    // 1000 * (1 - 33.33/100) = 1000 * 0.6667 = 666.7 (already 1 decimal)
    expect(precioFromPct(1000, 33.33)).toBe(666.7)
  })

  it('round-trips with pctFromPrecio — price → pct → price', () => {
    const originalPrecio = 750
    const pct = pctFromPrecio(1000, originalPrecio)
    const recovered = precioFromPct(1000, pct)
    // May have ±0.01 rounding drift — accept within 1 cent
    expect(Math.abs(recovered - originalPrecio)).toBeLessThanOrEqual(0.01)
  })

  it('handles fractional precioVenta', () => {
    expect(precioFromPct(99.99, 10)).toBe(89.99)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canViewCost
// ─────────────────────────────────────────────────────────────────────────────

describe('canViewCost', () => {
  it('returns false for Empleado', () => {
    expect(canViewCost(['Empleado'])).toBe(false)
  })

  it('returns true for Administrador', () => {
    expect(canViewCost(['Administrador'])).toBe(true)
  })

  it('returns true for AdministradorSistemas', () => {
    expect(canViewCost(['AdministradorSistemas'])).toBe(true)
  })

  it('returns true for Gerencia', () => {
    expect(canViewCost(['Gerencia'])).toBe(true)
  })

  it('returns false for empty roles array', () => {
    expect(canViewCost([])).toBe(false)
  })

  it('returns true when cost role is mixed with non-cost roles', () => {
    expect(canViewCost(['Empleado', 'Gerencia'])).toBe(true)
  })

  it('mirrors AppRoles.CostViewingRoles — case sensitive', () => {
    // Role names from server are exactly: AdministradorSistemas, Administrador, Gerencia, Empleado
    expect(canViewCost(['administrador'])).toBe(false)
    expect(canViewCost(['GERENCIA'])).toBe(false)
  })
})
