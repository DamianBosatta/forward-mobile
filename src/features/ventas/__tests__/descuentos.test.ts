/**
 * TASK 2 — Rebased tests for descuentos.ts (unified single-server-floor).
 *
 * PR-2e-a: the mobile lib now mirrors web es-descuento-valido.ts exactly.
 * - EsDescuentoValidoCompuestoInput no longer has precioCompraBase / margenGlobal.
 * - Single floor: precioMinimo (server-computed PrecioMinimoRentable).
 * - Null floor → fail-OPEN (not invalid, not floor-broken).
 * - derivarFloorBroken: NO 0-discount early-return; a base price already below
 *   the server floor MUST be flagged even with 0% discounts applied.
 */

import { esPrecioValido } from '../lib/descuentos'

// ─────────────────────────────────────────────────────────────────────────────
// esPrecioValido — unified floor primitive (unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

describe('esPrecioValido (unified floor guard)', () => {
  it('returns false when precioFinal is below precioMinimo', () => {
    expect(esPrecioValido(750, 800)).toBe(false)
  })

  it('returns true when precioFinal equals precioMinimo exactly (inclusive at floor)', () => {
    expect(esPrecioValido(800, 800)).toBe(true)
  })

  it('returns true when precioFinal is above precioMinimo', () => {
    expect(esPrecioValido(900, 800)).toBe(true)
  })

  it('returns false for price 0 against any positive floor', () => {
    expect(esPrecioValido(0, 500)).toBe(false)
  })

  it('returns false when one cent below floor', () => {
    expect(esPrecioValido(799.99, 800)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// esDescuentoValidoCompuesto — unified single server floor (PR-2e-a)
// ─────────────────────────────────────────────────────────────────────────────

import {
  esDescuentoValidoCompuesto,
  derivarFloorBroken,
  type EsDescuentoValidoCompuestoInput,
} from '../lib/descuentos'

describe('esDescuentoValidoCompuesto — single server floor (precioMinimo)', () => {
  it('accepts when both item+general discounts stay at or above precioMinimo', () => {
    // effective = 1000 * 0.95 * 0.95 = 902.5, precioMinimo = 800
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 5,
        descGeneralPct: 5,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('rejects when compound effective price breaks precioMinimo', () => {
    // effective = 1000 * 0.70 * 0.80 = 560 < 800
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 30,
        descGeneralPct: 20,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(false)
  })

  it('accepts when only item discount is applied (general=0)', () => {
    // effective = 1000 * 0.90 = 900 >= 800
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 10,
        descGeneralPct: 0,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('accepts when only general discount is applied (item=0)', () => {
    // effective = 1000 * 0.90 = 900 >= 800
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 0,
        descGeneralPct: 10,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('accepts at exact precioMinimo boundary', () => {
    // effective = 1000 * 0.70 = 700 = precioMinimo exactly
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 0,
        descGeneralPct: 30,
        precioVenta: 1000,
        precioMinimo: 700,
      }),
    ).toBe(true)
  })

  it('rejects 1 cent below precioMinimo boundary', () => {
    // effective ≈ 699.99 < 700
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 0,
        descGeneralPct: 30.001,
        precioVenta: 1000,
        precioMinimo: 700,
      }),
    ).toBe(false)
  })

  // ── Null-floor policy (REQ-BANDS-03): fail-OPEN ───────────────────────────

  it('returns true (fail-open) when precioMinimo is null', () => {
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 50,
        descGeneralPct: 50,
        precioVenta: 1000,
        precioMinimo: null,
      }),
    ).toBe(true)
  })

  it('returns true (fail-open) when precioMinimo is undefined', () => {
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 50,
        descGeneralPct: 50,
        precioVenta: 1000,
      }),
    ).toBe(true)
  })

  it('returns true (fail-open) for massive discount when floor is null', () => {
    // Even 99% + 99% compound should be allowed when floor is unknown
    expect(
      esDescuentoValidoCompuesto({
        descItemPct: 99,
        descGeneralPct: 99,
        precioVenta: 1000,
        precioMinimo: null,
      }),
    ).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// derivarFloorBroken — unified, NO 0-discount early-return (PR-2e-a)
// ─────────────────────────────────────────────────────────────────────────────

describe('derivarFloorBroken — unified (no 0-discount early-return)', () => {
  it('returns true when compound effective price breaks precioMinimo', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 30,
        descGeneralPct: 20,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('returns false when compound satisfies precioMinimo', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 5,
        descGeneralPct: 5,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(false)
  })

  // NEW: base price already below floor WITH 0 discounts → MUST flag (parity with web)
  it('returns true when base price is already below precioMinimo with 0 discounts', () => {
    // precioVenta = 500, precioMinimo = 800 → effective = 500 < 800 → BROKEN
    // Old code had early-return at (0,0) → returned false (BUG).
    // New code: no early-return → returns true (correct).
    expect(
      derivarFloorBroken({
        descItemPct: 0,
        descGeneralPct: 0,
        precioVenta: 500,
        precioMinimo: 800,
      }),
    ).toBe(true)
  })

  it('returns false when base price equals precioMinimo with 0 discounts', () => {
    // effective = 800, floor = 800 → at floor exactly → not broken
    expect(
      derivarFloorBroken({
        descItemPct: 0,
        descGeneralPct: 0,
        precioVenta: 800,
        precioMinimo: 800,
      }),
    ).toBe(false)
  })

  it('returns false when base price is above precioMinimo with 0 discounts', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 0,
        descGeneralPct: 0,
        precioVenta: 1000,
        precioMinimo: 800,
      }),
    ).toBe(false)
  })

  // Null-floor policy: fail-OPEN (no red border when floor unknown)
  it('returns false (fail-open) when precioMinimo is null even with 0 discounts', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 0,
        descGeneralPct: 0,
        precioVenta: 500,
        precioMinimo: null,
      }),
    ).toBe(false)
  })

  it('returns false (fail-open) when precioMinimo is null with discounts applied', () => {
    expect(
      derivarFloorBroken({
        descItemPct: 50,
        descGeneralPct: 50,
        precioVenta: 1000,
        precioMinimo: null,
      }),
    ).toBe(false)
  })

  it('clears (returns false) when general discount reduced to 0 and price is above floor', () => {
    const brokenState = derivarFloorBroken({
      descItemPct: 5,
      descGeneralPct: 50,
      precioVenta: 1000,
      precioMinimo: 800,
    })
    expect(brokenState).toBe(true)

    const clearedState = derivarFloorBroken({
      descItemPct: 5,
      descGeneralPct: 0,
      precioVenta: 1000,
      precioMinimo: 800,
    })
    expect(clearedState).toBe(false)
  })
})
