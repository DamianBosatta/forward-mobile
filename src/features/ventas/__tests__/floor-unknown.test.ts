/**
 * M2 — floor-unknown guard tests (mobile, PR-2e-a).
 *
 * PR-2e-a unification: when precioMinimo is null/undefined the floor is UNKNOWN
 * and the modal/cart uses FAIL-OPEN policy (web parity, REQ-BANDS-03):
 *   - Cart line is NOT flagged red (derivarFloorBroken → false)
 *   - Discount is NOT blocked by floor logic (piercesFloor floor portion → false)
 *   - The HARD seller cap still blocks when exceeded
 *
 * The server is authoritative at submit time; client-side null-floor is advisory only.
 */

import { esPrecioValido, derivarFloorBroken, esDescuentoValidoCompuesto } from '../lib/descuentos'

// ─────────────────────────────────────────────────────────────────────────────
// Null-floor policy — fail-OPEN (PR-2e-a parity with web)
// ─────────────────────────────────────────────────────────────────────────────

describe('M2 — floor-unknown: fail-OPEN policy (PR-2e-a)', () => {
  it('derivarFloorBroken returns false (fail-open) when precioMinimo is null', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 10,
        descGeneralPct: 0,
        precioVenta: 1000,
        precioMinimo: null,
      }),
    ).toBe(false)
  })

  it('derivarFloorBroken returns false (fail-open) when precioMinimo is undefined', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 5,
        descGeneralPct: 5,
        precioVenta: 500,
      }),
    ).toBe(false)
  })

  it('derivarFloorBroken returns false even with 0 discounts and null floor', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 0,
        descGeneralPct: 0,
        precioVenta: 100,
        precioMinimo: null,
      }),
    ).toBe(false)
  })

  it('esDescuentoValidoCompuesto returns true (fail-open) when precioMinimo is null', () => {
    // Even a massive discount is "valid" when the floor is unknown (server is authoritative)
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 99,
        descGeneralPct: 99,
        precioVenta: 1000,
        precioMinimo: null,
      }),
    ).toBe(true)
  })

  it('esDescuentoValidoCompuesto returns true (fail-open) when precioMinimo is undefined', () => {
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 50,
        descGeneralPct: 0,
        precioVenta: 1000,
      }),
    ).toBe(true)
  })

  // ── When floor IS known, the guard works normally ─────────────────────────

  it('derivarFloorBroken returns true when floor IS known and price breaks it', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 50,
        descGeneralPct: 0,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('esPrecioValido returns false when price is below floor', () => {
    // precioMinimo known, price below → NOT valid
    expect(esPrecioValido(750, 800)).toBe(false)
  })

  it('esPrecioValido returns true when price meets floor exactly', () => {
    expect(esPrecioValido(800, 800)).toBe(true)
  })

  it('esPrecioValido returns true when price is above floor', () => {
    expect(esPrecioValido(950, 800)).toBe(true)
  })
})
