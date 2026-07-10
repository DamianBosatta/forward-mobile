/**
 * S4 corrected RED tests for rentabilidad-venta mobile helpers.
 *
 * Formula (additive — S4 corrected, identical to web):
 *   costoTotal  = Σ precioCostoSnapshot * cantidad
 *   ingresoNeto = subtotalBruto - montoDescuento   (post-general-discount, EXCLUDES flete)
 *   margenNeto  = ingresoNeto - costoTotal
 *   margenPct   = ingresoNeto > 0 ? (margenNeto / ingresoNeto) * 100 : 0
 */

import {
  calcularRentabilidadVenta,
  puedeVerRentabilidad,
} from '../lib/rentabilidad-venta'

// ─────────────────────────────────────────────────────────────────────────────
// calcularRentabilidadVenta
// ─────────────────────────────────────────────────────────────────────────────

describe('calcularRentabilidadVenta', () => {
  // S4-corrected case 1: no discount, no flete
  // subtotal=1000, one line precioUnitario=1000 qty=1 cost=600, montoDescuento=0
  // ingresoNeto=1000, costoTotal=600, margenNeto=400, margenPct=40%
  it('case 1: no discount, no flete → margenNeto 400, margenPct 40%', () => {
    const result = calcularRentabilidadVenta({
      detalles: [{ precioUnitario: 1000, precioCostoSnapshot: 600, cantidad: 1 }],
      subtotalBruto: 1000,
      montoDescuento: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.margenNeto).toBeCloseTo(400, 5)
    expect(result!.margenPct).toBeCloseTo(40, 2)
  })

  // S4-corrected case 2: general discount 20%, no flete
  // subtotal=1000, cost=600, montoDescuento=200
  // ingresoNeto=800, margenNeto=200, margenPct=25%
  it('case 2: general discount 20%, no flete → margenNeto 200, margenPct 25%', () => {
    const result = calcularRentabilidadVenta({
      detalles: [{ precioUnitario: 1000, precioCostoSnapshot: 600, cantidad: 1 }],
      subtotalBruto: 1000,
      montoDescuento: 200,
    })
    expect(result).not.toBeNull()
    expect(result!.margenNeto).toBeCloseTo(200, 5)
    expect(result!.margenPct).toBeCloseTo(25, 2)
  })

  // S4-corrected case 3: no discount, flete 200 (flete excluded — not passed in)
  // ingresoNeto=1000, margenNeto=400, margenPct=40%  (NOT 480)
  it('case 3: no discount, flete 200 excluded → margenNeto 400, margenPct 40%', () => {
    const result = calcularRentabilidadVenta({
      detalles: [{ precioUnitario: 1000, precioCostoSnapshot: 600, cantidad: 1 }],
      subtotalBruto: 1000,
      montoDescuento: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.margenNeto).toBeCloseTo(400, 5)
    expect(result!.margenPct).toBeCloseTo(40, 2)
  })

  // S4-corrected case 4: general 20% + flete 200 (flete excluded)
  // ingresoNeto=800, margenNeto=200, margenPct=25%
  it('case 4: general 20% + flete 200 → margenNeto 200, margenPct 25% (flete excluded)', () => {
    const result = calcularRentabilidadVenta({
      detalles: [{ precioUnitario: 1000, precioCostoSnapshot: 600, cantidad: 1 }],
      subtotalBruto: 1000,
      montoDescuento: 200,
    })
    expect(result).not.toBeNull()
    expect(result!.margenNeto).toBeCloseTo(200, 5)
    expect(result!.margenPct).toBeCloseTo(25, 2)
  })

  // S4-corrected case 5a: empty detalles → null
  it('case 5a: empty detalles → null', () => {
    expect(
      calcularRentabilidadVenta({ detalles: [], subtotalBruto: 0, montoDescuento: 0 })
    ).toBeNull()
  })

  // S4-corrected case 5b: subtotalBruto 0 → null
  it('case 5b: subtotalBruto 0 → null', () => {
    expect(
      calcularRentabilidadVenta({
        detalles: [{ precioUnitario: 0, precioCostoSnapshot: 0, cantidad: 1 }],
        subtotalBruto: 0,
        montoDescuento: 0,
      })
    ).toBeNull()
  })

  // S4-corrected case 5c: ingresoNeto 0 (100% general discount) → margenPct 0 guard
  it('case 5c: ingresoNeto 0 (100% general discount) → margenPct 0 guard', () => {
    const result = calcularRentabilidadVenta({
      detalles: [{ precioUnitario: 1000, precioCostoSnapshot: 600, cantidad: 1 }],
      subtotalBruto: 1000,
      montoDescuento: 1000,
    })
    expect(result).not.toBeNull()
    expect(result!.margenPct).toBe(0)
  })

  // Guard: null when any line has null precioCostoSnapshot
  it('returns null when any line has null precioCostoSnapshot', () => {
    expect(
      calcularRentabilidadVenta({
        detalles: [
          { precioUnitario: 100, precioCostoSnapshot: 70,   cantidad: 1 },
          { precioUnitario: 50,  precioCostoSnapshot: null, cantidad: 2 },
        ],
        subtotalBruto: 200,
        montoDescuento: 0,
      })
    ).toBeNull()
  })

  // Multiple lines
  it('aggregates margin across multiple lines', () => {
    // Line 1: precioUnitario=100, costo=70, qty=1 → cost=70
    // Line 2: precioUnitario=50,  costo=30, qty=3 → cost=90
    // subtotalBruto=250, montoDescuento=0
    // ingresoNeto=250, costoTotal=160, margenNeto=90, margenPct=36%
    const result = calcularRentabilidadVenta({
      detalles: [
        { precioUnitario: 100, precioCostoSnapshot: 70, cantidad: 1 },
        { precioUnitario: 50,  precioCostoSnapshot: 30, cantidad: 3 },
      ],
      subtotalBruto: 250,
      montoDescuento: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.margenNeto).toBeCloseTo(90, 5)
    expect(result!.margenPct).toBeCloseTo(36, 2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// puedeVerRentabilidad
// ─────────────────────────────────────────────────────────────────────────────

describe('puedeVerRentabilidad', () => {
  // S4-T5.7 — all lines have cost data
  it('returns true when all lines have non-null precioCostoSnapshot', () => {
    const detalles = [
      { precioUnitario: 100, precioCostoSnapshot: 70, cantidad: 1 },
      { precioUnitario: 50,  precioCostoSnapshot: 30, cantidad: 2 },
    ]
    expect(puedeVerRentabilidad(detalles)).toBe(true)
  })

  // S4-T5.8 — vendedor path: any null → false
  it('returns false when any line has null precioCostoSnapshot', () => {
    const detalles = [
      { precioUnitario: 100, precioCostoSnapshot: 70,   cantidad: 1 },
      { precioUnitario: 50,  precioCostoSnapshot: null, cantidad: 2 },
    ]
    expect(puedeVerRentabilidad(detalles)).toBe(false)
  })

  // S4-T5.9 — empty array → false
  it('returns false for empty detalles array', () => {
    expect(puedeVerRentabilidad([])).toBe(false)
  })
})
