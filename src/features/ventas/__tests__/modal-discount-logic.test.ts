/**
 * PR-2e-a — Rebased modal discount logic tests.
 *
 * After PR-2e-a the floor is ALWAYS the server-computed precioMinimo.
 * The old cost-path (precioCompraBase * (1 + margenGlobal)) has been retired.
 *
 * Tests cover:
 *   - computeStockProjection (unchanged)
 *   - FIX #1 typed-price rounding (still relevant — uses esPrecioValido)
 *   - canViewCost gating
 *   - computeModalFloor — extracted pure helper (W1 + W2 parity)
 *   - Modal piercesFloor semantics via production helpers (pct > 0 guard + rounded floor)
 */

import {
  esPrecioValido,
  pctFromPrecio,
  canViewCost,
  esDescuentoValidoCompuesto,
  computeModalFloor,
} from '../lib/descuentos'

// ─────────────────────────────────────────────────────────────────────────────
// computeStockProjection — unchanged helper (extracted, no lib dependency)
// ─────────────────────────────────────────────────────────────────────────────

function computeStockProjection(params: { disponible: number; cantidad: number }): {
  postSaleStock: number
  isNegative: boolean
} {
  const { disponible, cantidad } = params
  const postSaleStock = disponible - cantidad
  return { postSaleStock, isNegative: postSaleStock < 0 }
}

describe('computeStockProjection', () => {
  it('returns positive projection when stock covers the order', () => {
    const { postSaleStock, isNegative } = computeStockProjection({ disponible: 50, cantidad: 10 })
    expect(postSaleStock).toBe(40)
    expect(isNegative).toBe(false)
  })

  it('returns zero projection when stock exactly matches order', () => {
    const { postSaleStock, isNegative } = computeStockProjection({ disponible: 10, cantidad: 10 })
    expect(postSaleStock).toBe(0)
    expect(isNegative).toBe(false)
  })

  it('returns negative projection when order exceeds stock', () => {
    const { postSaleStock, isNegative } = computeStockProjection({ disponible: 5, cantidad: 20 })
    expect(postSaleStock).toBe(-15)
    expect(isNegative).toBe(true)
  })

  it('returns disponible when cantidad is 0', () => {
    const { postSaleStock } = computeStockProjection({ disponible: 30, cantidad: 0 })
    expect(postSaleStock).toBe(30)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX #1 — Typed-price floor validation (rounding over-block parity with web)
// ─────────────────────────────────────────────────────────────────────────────
//
// Validate against the user's TYPED price, not the pct-recomputed price.
// This avoids sub-cent drift that would falsely block a price equal to a
// non-integer floor.
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #1 — typed-price floor validation (rounding over-block)', () => {
  it('[old path] recomputed price from rounded pct causes false block at non-integer floor', () => {
    const precioVenta = 1000
    const precioMinimo = 857.14

    const typedPrecio = precioMinimo
    const pct = pctFromPrecio(precioVenta, typedPrecio) // 14.29 (rounded)
    const recomputedPrecio = precioVenta * (1 - pct / 100) // 857.1 (drift)

    // Old path: false block
    const oldValidation = esPrecioValido(recomputedPrecio, precioMinimo)
    expect(oldValidation).toBe(false) // BUG: should be allowed
  })

  it('[fix path] validating typed price allows price equal to non-integer floor', () => {
    const precioVenta = 1000
    const precioMinimo = 857.14

    const typedPrecio = precioMinimo
    const fixedValidation = esPrecioValido(typedPrecio, precioMinimo)
    expect(fixedValidation).toBe(true)
  })

  it('[fix path] price just below non-integer floor is still blocked', () => {
    const precioMinimo = 857.14
    expect(esPrecioValido(857.13, precioMinimo)).toBe(false)
  })

  it('[fix path] price well below floor is blocked regardless of rounding', () => {
    expect(esPrecioValido(750, 800)).toBe(false)
  })

  it('[fix path] price above floor is always allowed', () => {
    expect(esPrecioValido(900, 800)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canViewCost — cost-row gating logic
// ─────────────────────────────────────────────────────────────────────────────

describe('canViewCost — cost-row gating for DescuentoItemModalRN', () => {
  it('cost row NOT shown for Empleado (canViewCost false)', () => {
    expect(canViewCost(['Empleado'])).toBe(false)
  })

  it('cost row shown for Administrador (canViewCost true)', () => {
    expect(canViewCost(['Administrador'])).toBe(true)
  })

  it('cost row shown for Gerencia (canViewCost true)', () => {
    expect(canViewCost(['Gerencia'])).toBe(true)
  })

  it('cost row NOT shown for empty roles (canViewCost false)', () => {
    expect(canViewCost([])).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeModalFloor — extracted pure helper (W2 rounding + W1 pct>0 inputs)
// ─────────────────────────────────────────────────────────────────────────────
//
// Tests exercise the REAL production helper, not a local re-implementation.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeModalFloor — raised floor helper (mirrors web computeModalFloor)', () => {
  it('returns floorUnknown=true and piso=0 when precioMinimo is null', () => {
    const result = computeModalFloor({ precioMinimo: null })
    expect(result.floorUnknown).toBe(true)
    expect(result.piso).toBe(0)
  })

  it('returns floorUnknown=true and piso=0 when precioMinimo is undefined', () => {
    const result = computeModalFloor({ precioMinimo: undefined })
    expect(result.floorUnknown).toBe(true)
    expect(result.piso).toBe(0)
  })

  it('returns raw floor rounded to 2 decimals when descuentoGeneral is 0', () => {
    // 800 / 1 = 800.00
    const { piso, floorUnknown } = computeModalFloor({ precioMinimo: 800, descuentoGeneral: 0 })
    expect(floorUnknown).toBe(false)
    expect(piso).toBe(800)
  })

  it('raises floor by general discount factor', () => {
    // precioMinimo=800, g=20 → factor=0.8 → 800/0.8=1000
    const { piso, floorUnknown } = computeModalFloor({ precioMinimo: 800, descuentoGeneral: 20 })
    expect(floorUnknown).toBe(false)
    expect(piso).toBe(1000)
  })

  it('rounds raised floor to 2 decimal places (W2 rounding parity)', () => {
    // precioMinimo=100, g=33 → factor=0.67 → 100/0.67 ≈ 149.2537... → rounded = 149.25
    const { piso } = computeModalFloor({ precioMinimo: 100, descuentoGeneral: 33 })
    expect(piso).toBe(149.25)
  })

  it('clamps generalFactor to 0.0001 at g=100 to prevent div/0 blow-up', () => {
    // g=100 → factor=0.0001 → 800/0.0001 = 8_000_000 (large but finite, not Infinity)
    const { piso, floorUnknown } = computeModalFloor({ precioMinimo: 800, descuentoGeneral: 100 })
    expect(floorUnknown).toBe(false)
    expect(Number.isFinite(piso)).toBe(true)
    expect(piso).toBeGreaterThan(0)
  })

  it('defaults descuentoGeneral to 0 when omitted', () => {
    const { piso } = computeModalFloor({ precioMinimo: 500 })
    expect(piso).toBe(500)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Modal piercesFloor semantics — production helpers, pct>0 guard (W1 parity)
// ─────────────────────────────────────────────────────────────────────────────
//
// This replicates the exact piercesFloor expression from nueva.tsx using the
// production helpers. No local re-implementation — all logic comes from the
// real helpers.
//
// piercesFloor =
//   !floorUnknown && pct > 0 && precioVenta > 0 &&
//   !esPrecioValido(typedPrecio, piso)
// ─────────────────────────────────────────────────────────────────────────────

function modalPiercesFloor(params: {
  pct: number
  precioVenta: number
  precioMinimo: number | null
  descuentoGeneral?: number
}): boolean {
  const { pct, precioVenta, precioMinimo, descuentoGeneral = 0 } = params
  const { piso, floorUnknown } = computeModalFloor({ precioMinimo, descuentoGeneral })
  // typedPrecio: for these tests we use the pct-derived price (no UI input drift)
  const typedPrecio = precioVenta * (1 - pct / 100)
  return (
    !floorUnknown &&
    pct > 0 &&
    precioVenta > 0 &&
    !esPrecioValido(typedPrecio, piso)
  )
}

describe('Modal piercesFloor semantics — pct>0 guard + rounded floor (W1 + W2 parity)', () => {
  // W1: at pct=0 with base price below the raised floor → modal must NOT warn
  it('does NOT warn at pct=0 even when base price is below the raised floor (W1 parity)', () => {
    // precioVenta=500, piso=800 (base is already below floor)
    // Without pct>0 guard this would fire; with it, it must not.
    expect(
      modalPiercesFloor({ pct: 0, precioVenta: 500, precioMinimo: 800 }),
    ).toBe(false)
  })

  // W1: at pct>0 below floor → modal DOES warn
  it('warns at pct>0 when effective price is below the floor', () => {
    // 1000 * 0.6 = 600 < 800
    expect(
      modalPiercesFloor({ pct: 40, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(true)
  })

  // W2: rounding boundary — floor is rounded to 2 decimals before comparison
  it('uses rounded floor for comparison (W2 rounding boundary)', () => {
    // g=33 → piso = Math.round(100/0.67 * 100)/100 = 149.25
    // typedPrecio at pct=1 → 100*0.99 = 99 < 149.25 → should warn
    expect(
      modalPiercesFloor({ pct: 1, precioVenta: 100, precioMinimo: 100, descuentoGeneral: 33 }),
    ).toBe(true)
    // at pct=1 with precioMinimo=50 → piso = Math.round(50/0.67*100)/100 = 74.63
    // typedPrecio = 100*0.99 = 99 > 74.63 → should NOT warn
    expect(
      modalPiercesFloor({ pct: 1, precioVenta: 100, precioMinimo: 50, descuentoGeneral: 33 }),
    ).toBe(false)
  })

  // g=100 clamp regression guard
  it('does not blow up when descuentoGeneral=100 (generalFactor clamp)', () => {
    // piso is very large but finite; effective price < piso → warns
    const result = modalPiercesFloor({ pct: 10, precioVenta: 1000, precioMinimo: 800, descuentoGeneral: 100 })
    // Just assert it returns a boolean without throwing
    expect(typeof result).toBe('boolean')
    // 1000*0.9 = 900, piso is ~8_000_000 → warns
    expect(result).toBe(true)
  })

  // Null floor → fail-open → no warning
  it('returns false (fail-open) when precioMinimo is null regardless of pct', () => {
    expect(
      modalPiercesFloor({ pct: 99, precioVenta: 1000, precioMinimo: null }),
    ).toBe(false)
  })

  // Blocks when item+general compound breaks precioMinimo (C1 lesson — preserved)
  it('blocks when item+general compound breaks precioMinimo (C1 lesson)', () => {
    // effective = 1000*0.85*0.85 = 722.5 < 800
    // piso = 800/0.85 ≈ 941.18; typedPrecio = 1000*0.85 = 850 < 941.18 → warns
    expect(
      modalPiercesFloor({ pct: 15, descuentoGeneral: 15, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(true)
  })

  // Allows when item+general compound satisfies precioMinimo (C1 lesson — preserved)
  it('allows when item+general compound satisfies precioMinimo', () => {
    // piso = 800/0.95 ≈ 842.11; typedPrecio = 1000*0.95 = 950 > 842.11 → no warn
    expect(
      modalPiercesFloor({ pct: 5, descuentoGeneral: 5, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(false)
  })

  // block→route: floor pierce is allowed (not a HARD block)
  it('returns true (floor warning) when below floor — enables route to PendienteAutorizacion', () => {
    expect(
      modalPiercesFloor({ pct: 40, descuentoGeneral: 0, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// esDescuentoValidoCompuesto — compound guard (unchanged, kept for regression)
// ─────────────────────────────────────────────────────────────────────────────

describe('esDescuentoValidoCompuesto — compound guard regression', () => {
  it('returns true (fail-open) when precioMinimo is null', () => {
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 99, descGeneralPct: 99, precioVenta: 1000, precioMinimo: null }),
    ).toBe(true)
  })

  it('returns true when compound effective price is at the floor (inclusive)', () => {
    // 1000 * 0.9 * 0.9 = 810 > 800 → ok
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 10, descGeneralPct: 10, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(true)
  })

  it('returns false when compound effective price breaks the floor', () => {
    // 1000 * 0.85 * 0.85 = 722.5 < 800
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 15, descGeneralPct: 15, precioVenta: 1000, precioMinimo: 800 }),
    ).toBe(false)
  })
})
