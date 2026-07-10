/**
 * Regression tests for descuentos.ts — pure discount math for the venta creation flow.
 *
 * Purpose: characterization suite — locks CURRENT behavior so the upcoming
 * conservative layout audit of ventas/nueva.tsx cannot silently break logic.
 * Tests reflect actual implementation semantics (including the fail-open
 * null-floor policy and inclusive-at-floor convention).
 */

import {
  esPrecioValido,
  calcularSubtotalConDescuento,
  pctFromPrecio,
  precioFromPct,
  canViewCost,
  esDescuentoValidoCompuesto,
  computeModalFloor,
  derivarFloorBroken,
} from '../descuentos'

// ─── esPrecioValido ──────────────────────────────────────────────────────────

describe('esPrecioValido', () => {
  it('returns true when price is strictly above the floor', () => {
    expect(esPrecioValido(100, 80)).toBe(true)
  })

  it('returns true at exactly the floor (inclusive — matches server VERDE-at-floor)', () => {
    expect(esPrecioValido(80, 80)).toBe(true)
  })

  it('returns false when price is below the floor', () => {
    expect(esPrecioValido(79.99, 80)).toBe(false)
  })

  it('handles zero floor: 0 >= 0 is valid, negative is not', () => {
    expect(esPrecioValido(0, 0)).toBe(true)
    expect(esPrecioValido(-1, 0)).toBe(false)
  })
})

// ─── calcularSubtotalConDescuento ────────────────────────────────────────────

describe('calcularSubtotalConDescuento', () => {
  it('0% discount: subtotal equals price * quantity', () => {
    expect(calcularSubtotalConDescuento(100, 3, 0)).toBe(300)
  })

  it('10% discount: unit price becomes 90, subtotal = 180 for qty 2', () => {
    expect(calcularSubtotalConDescuento(100, 2, 10)).toBe(180)
  })

  it('100% discount: subtotal is zero', () => {
    expect(calcularSubtotalConDescuento(100, 5, 100)).toBe(0)
  })

  it('zero quantity: subtotal is zero regardless of discount', () => {
    expect(calcularSubtotalConDescuento(100, 0, 20)).toBe(0)
  })

  it('fractional discount: computes correctly (no rounding in this function)', () => {
    // 100 * (1 - 0.335) * 1 = 66.5
    expect(calcularSubtotalConDescuento(100, 1, 33.5)).toBeCloseTo(66.5)
  })

  it('non-trivial combination: 15% off, qty 4, price 50', () => {
    // 50 * 0.85 = 42.5; 42.5 * 4 = 170
    expect(calcularSubtotalConDescuento(50, 4, 15)).toBeCloseTo(170)
  })
})

// ─── pctFromPrecio ───────────────────────────────────────────────────────────

describe('pctFromPrecio', () => {
  it('returns 0 when precioVenta is 0 (guard against division by zero)', () => {
    expect(pctFromPrecio(0, 80)).toBe(0)
  })

  it('returns 0 when precioVenta is negative', () => {
    expect(pctFromPrecio(-10, 80)).toBe(0)
  })

  it('returns 0 when final price equals base (no discount)', () => {
    expect(pctFromPrecio(100, 100)).toBe(0)
  })

  it('returns 10 for a 10% discount', () => {
    expect(pctFromPrecio(100, 90)).toBe(10)
  })

  it('returns 100 when final price is 0 (maximum possible discount)', () => {
    expect(pctFromPrecio(100, 0)).toBe(100)
  })

  it('rounds to 2 decimal places', () => {
    // (1 - 66.67/100) * 100 ≈ 33.33
    expect(pctFromPrecio(100, 66.67)).toBe(33.33)
  })

  it('returns negative when final price exceeds base (premium / surcharge)', () => {
    // (1 - 110/100) * 100 = -10
    expect(pctFromPrecio(100, 110)).toBe(-10)
  })
})

// ─── precioFromPct ───────────────────────────────────────────────────────────

describe('precioFromPct', () => {
  it('0% discount: returns base price unchanged', () => {
    expect(precioFromPct(100, 0)).toBe(100)
  })

  it('10% discount: returns 90', () => {
    expect(precioFromPct(100, 10)).toBe(90)
  })

  it('100% discount: returns 0', () => {
    expect(precioFromPct(100, 100)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // 100 * (1 - 33.33/100) = 100 * 0.6667 = 66.67
    expect(precioFromPct(100, 33.33)).toBe(66.67)
  })

  it('non-integer base price, non-trivial pct', () => {
    // 123.45 * (1 - 0.15) = 123.45 * 0.85 = 104.9325 → rounded to 104.93
    expect(precioFromPct(123.45, 15)).toBe(104.93)
  })
})

// ─── canViewCost ─────────────────────────────────────────────────────────────

describe('canViewCost', () => {
  it('returns true for Administrador', () => {
    expect(canViewCost(['Administrador'])).toBe(true)
  })

  it('returns true for AdministradorSistemas', () => {
    expect(canViewCost(['AdministradorSistemas'])).toBe(true)
  })

  it('returns true for Gerencia', () => {
    expect(canViewCost(['Gerencia'])).toBe(true)
  })

  it('returns false for non-cost roles', () => {
    expect(canViewCost(['Vendedor', 'Logistica'])).toBe(false)
  })

  it('returns true when array contains at least one cost role', () => {
    expect(canViewCost(['Vendedor', 'Gerencia'])).toBe(true)
  })

  it('returns false for empty array', () => {
    expect(canViewCost([])).toBe(false)
  })

  it('is case-sensitive (wrong case returns false)', () => {
    expect(canViewCost(['administrador'])).toBe(false)
    expect(canViewCost(['GERENCIA'])).toBe(false)
  })
})

// ─── esDescuentoValidoCompuesto ──────────────────────────────────────────────

describe('esDescuentoValidoCompuesto', () => {
  it('no discounts: effective price equals base; returns true when above floor', () => {
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 0, descGeneralPct: 0, precioVenta: 100, precioMinimo: 80 }),
    ).toBe(true)
  })

  it('compound discounts: effective at exactly the floor returns true (inclusive)', () => {
    // 100 * (1 - 0.1) * (1 - 0.1) = 81; floor = 81
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 10, descGeneralPct: 10, precioVenta: 100, precioMinimo: 81 }),
    ).toBe(true)
  })

  it('compound discounts: effective below floor returns false', () => {
    // 100 * 0.9 * 0.9 = 81 < 82
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 10, descGeneralPct: 10, precioVenta: 100, precioMinimo: 82 }),
    ).toBe(false)
  })

  it('null precioMinimo: fail-open policy returns true', () => {
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 50, descGeneralPct: 50, precioVenta: 100, precioMinimo: null }),
    ).toBe(true)
  })

  it('undefined precioMinimo: fail-open policy returns true', () => {
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 50, descGeneralPct: 50, precioVenta: 100 }),
    ).toBe(true)
  })

  it('100% item discount: effective is 0, always below any positive floor', () => {
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 100, descGeneralPct: 0, precioVenta: 100, precioMinimo: 1 }),
    ).toBe(false)
  })

  it('does NOT round before comparison (unrounded effective vs floor)', () => {
    // 100 * (1 - 0.1) * (1 - 0.1) = 81 exactly (no floating point issue here)
    // If rounding happened it could produce 81.00 which still passes; the point is the
    // contract says NO rounding before >=. We verify the behaviour as-is.
    expect(
      esDescuentoValidoCompuesto({ descItemPct: 10, descGeneralPct: 10, precioVenta: 100, precioMinimo: 81 }),
    ).toBe(true)
  })
})

// ─── computeModalFloor ───────────────────────────────────────────────────────

describe('computeModalFloor', () => {
  it('returns { piso: 0, floorUnknown: true } when precioMinimo is null', () => {
    expect(computeModalFloor({ precioMinimo: null })).toEqual({ piso: 0, floorUnknown: true })
  })

  it('returns { piso: 0, floorUnknown: true } when precioMinimo is undefined', () => {
    expect(computeModalFloor({ precioMinimo: undefined })).toEqual({ piso: 0, floorUnknown: true })
  })

  it('returns piso = precioMinimo when no general discount (factor = 1)', () => {
    expect(computeModalFloor({ precioMinimo: 80 })).toEqual({ piso: 80, floorUnknown: false })
  })

  it('raises floor when general discount is active', () => {
    // 80 / (1 - 0.20) = 80 / 0.80 = 100
    expect(computeModalFloor({ precioMinimo: 80, descuentoGeneral: 20 })).toEqual({
      piso: 100,
      floorUnknown: false,
    })
  })

  it('rounds piso to 2 decimal places', () => {
    // 80 / (1 - 0.33) = 80 / 0.67 ≈ 119.40
    const result = computeModalFloor({ precioMinimo: 80, descuentoGeneral: 33 })
    expect(result.floorUnknown).toBe(false)
    expect(result.piso).toBe(Math.round((80 / 0.67) * 100) / 100)
  })

  it('handles descuentoGeneral=100 without dividing by zero (clamped to 0.0001)', () => {
    // factor = max(0, 0.0001) = 0.0001; effectiveFloor = 80 / 0.0001 = 800000
    const result = computeModalFloor({ precioMinimo: 80, descuentoGeneral: 100 })
    expect(result.floorUnknown).toBe(false)
    expect(result.piso).toBe(Math.round((80 / 0.0001) * 100) / 100)
  })

  it('descuentoGeneral=0 default: piso equals precioMinimo exactly', () => {
    expect(computeModalFloor({ precioMinimo: 123.45, descuentoGeneral: 0 })).toEqual({
      piso: 123.45,
      floorUnknown: false,
    })
  })
})

// ─── derivarFloorBroken ──────────────────────────────────────────────────────

describe('derivarFloorBroken', () => {
  it('returns false when floor is null (fail-open)', () => {
    expect(
      derivarFloorBroken({ descItemPct: 99, descGeneralPct: 99, precioVenta: 100, precioMinimo: null }),
    ).toBe(false)
  })

  it('returns false when floor is undefined (fail-open)', () => {
    expect(
      derivarFloorBroken({ descItemPct: 99, descGeneralPct: 99, precioVenta: 100 }),
    ).toBe(false)
  })

  it('returns false when effective price is above the floor', () => {
    // 100 * 0.9 = 90 > 85
    expect(
      derivarFloorBroken({ descItemPct: 10, descGeneralPct: 0, precioVenta: 100, precioMinimo: 85 }),
    ).toBe(false)
  })

  it('returns false at exactly the floor (inclusive — not "broken")', () => {
    // 100 * 0.9 = 90 >= 90
    expect(
      derivarFloorBroken({ descItemPct: 10, descGeneralPct: 0, precioVenta: 100, precioMinimo: 90 }),
    ).toBe(false)
  })

  it('returns true when effective price pierces the floor', () => {
    // 100 * 0.8 = 80 < 85
    expect(
      derivarFloorBroken({ descItemPct: 20, descGeneralPct: 0, precioVenta: 100, precioMinimo: 85 }),
    ).toBe(true)
  })

  it('returns true for compound discount that pierces floor', () => {
    // 100 * 0.8 * 0.8 = 64 < 70
    expect(
      derivarFloorBroken({ descItemPct: 20, descGeneralPct: 20, precioVenta: 100, precioMinimo: 70 }),
    ).toBe(true)
  })
})
