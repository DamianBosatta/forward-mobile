/**
 * Unit tests for calcularRoiProducto (mobile inventario).
 *
 * Formula under test (D6 design / web parity):
 *   grossProfit  = precioVentaSugerido - costoUnitario
 *   roiPercentage = (grossProfit / costoUnitario) * 100
 *
 * Guard: when costoUnitario <= 0, both values are 0 (no division by zero).
 */

import { calcularRoiProducto } from '../lib/producto-roi'

describe('calcularRoiProducto — normal cases', () => {
  it('calculates grossProfit and roiPercentage for a simple case', () => {
    // cost=100, price=150 → grossProfit=50, roi=50%
    const result = calcularRoiProducto(150, 100)
    expect(result.grossProfit).toBeCloseTo(50)
    expect(result.roiPercentage).toBeCloseTo(50)
  })

  it('matches web formula: roi = grossProfit / cost * 100', () => {
    // cost=200, price=280 → grossProfit=80, roi=40%
    const result = calcularRoiProducto(280, 200)
    expect(result.grossProfit).toBeCloseTo(80)
    expect(result.roiPercentage).toBeCloseTo(40)
  })

  it('returns negative grossProfit when price is below cost', () => {
    // Unusual but valid (loss scenario)
    const result = calcularRoiProducto(80, 100)
    expect(result.grossProfit).toBeCloseTo(-20)
    expect(result.roiPercentage).toBeCloseTo(-20)
  })

  it('returns zero grossProfit and zero roi when price equals cost', () => {
    const result = calcularRoiProducto(100, 100)
    expect(result.grossProfit).toBeCloseTo(0)
    expect(result.roiPercentage).toBeCloseTo(0)
  })

  it('handles fractional costs and prices correctly', () => {
    // cost=33.33, price=50 → grossProfit≈16.67, roi≈50.01%
    const result = calcularRoiProducto(50, 33.33)
    expect(result.grossProfit).toBeCloseTo(16.67, 1)
    expect(result.roiPercentage).toBeCloseTo(50.01, 0)
  })

  it('handles large values without overflow', () => {
    const result = calcularRoiProducto(1_500_000, 1_000_000)
    expect(result.grossProfit).toBeCloseTo(500_000)
    expect(result.roiPercentage).toBeCloseTo(50)
  })
})

describe('calcularRoiProducto — cost <= 0 guard', () => {
  it('returns { grossProfit: 0, roiPercentage: 0 } when cost is zero', () => {
    const result = calcularRoiProducto(150, 0)
    expect(result.grossProfit).toBe(0)
    expect(result.roiPercentage).toBe(0)
  })

  it('returns { grossProfit: 0, roiPercentage: 0 } when cost is negative', () => {
    const result = calcularRoiProducto(150, -10)
    expect(result.grossProfit).toBe(0)
    expect(result.roiPercentage).toBe(0)
  })

  it('returns { grossProfit: 0, roiPercentage: 0 } when both price and cost are zero', () => {
    const result = calcularRoiProducto(0, 0)
    expect(result.grossProfit).toBe(0)
    expect(result.roiPercentage).toBe(0)
  })
})
