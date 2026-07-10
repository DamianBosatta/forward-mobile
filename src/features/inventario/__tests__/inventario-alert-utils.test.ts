/**
 * FASE 2 — Alert-derivation and filter logic tests (mobile).
 *
 * Imports from the REAL production modules — not copies.
 * Any change in alert-utils.ts will be caught here immediately.
 *
 * Mirror of web alert-utils tests (FASE 1 parity).
 */

import { derivarEstadoAlerta, filtrarSoloEnAlerta } from '../lib/alert-utils'
import type { StockItem } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'stock-1',
    productoId: 'prod-1',
    producto: 'Test Product',
    depositoId: 'dep-1',
    deposito: 'Depósito Central',
    cantidadActual: 50,
    cantidadVirtual: 5,
    cantidadTransito: 0,
    cantidadReservada: 0,
    cantidadDisponible: 50,
    stockMinimo: 10,
    enAlerta: false,
    activo: true,
    ...overrides,
  } as StockItem
}

// ─────────────────────────────────────────────────────────────────────────────
// derivarEstadoAlerta
// ─────────────────────────────────────────────────────────────────────────────

describe('derivarEstadoAlerta — server flag is authoritative', () => {
  it('returns enAlerta=true when server sets enAlerta=true regardless of disponible', () => {
    const item = makeItem({ enAlerta: true, cantidadDisponible: 50 })
    const result = derivarEstadoAlerta(item)
    expect(result.enAlerta).toBe(true)
  })

  it('returns enAlerta=false when server sets enAlerta=false even if stock looks low', () => {
    // Server says no alert — trust the server
    const item = makeItem({ enAlerta: false, cantidadDisponible: 3, stockMinimo: 10 })
    const result = derivarEstadoAlerta(item)
    expect(result.enAlerta).toBe(false)
  })

  it('returns enAlerta=false for a healthy item (no alert from server or client)', () => {
    const item = makeItem({ enAlerta: false, cantidadDisponible: 50 })
    const result = derivarEstadoAlerta(item)
    expect(result.enAlerta).toBe(false)
    expect(result.agotado).toBe(false)
    expect(result.stockBajo).toBe(false)
  })
})

describe('derivarEstadoAlerta — client fallback when enAlerta is undefined', () => {
  it('derives agotado=true when disponible <= 0 (no server flag)', () => {
    const item = makeItem({ enAlerta: undefined as any, cantidadDisponible: 0 })
    const result = derivarEstadoAlerta(item)
    expect(result.agotado).toBe(true)
    expect(result.enAlerta).toBe(true)
  })

  it('derives agotado=true when disponible is negative', () => {
    const item = makeItem({ enAlerta: undefined as any, cantidadDisponible: -5 })
    const result = derivarEstadoAlerta(item)
    expect(result.agotado).toBe(true)
    expect(result.enAlerta).toBe(true)
  })

  it('derives stockBajo=true when disponible is above 0 but at or below stockMinimo', () => {
    const item = makeItem({ enAlerta: undefined as any, cantidadDisponible: 7, stockMinimo: 10 })
    const result = derivarEstadoAlerta(item)
    expect(result.stockBajo).toBe(true)
    expect(result.agotado).toBe(false)
    expect(result.enAlerta).toBe(true)
  })

  it('derives enAlerta=false when disponible is above stockMinimo', () => {
    const item = makeItem({ enAlerta: undefined as any, cantidadDisponible: 20, stockMinimo: 10 })
    const result = derivarEstadoAlerta(item)
    expect(result.enAlerta).toBe(false)
    expect(result.stockBajo).toBe(false)
    expect(result.agotado).toBe(false)
  })

  it('falls back to cantidadActual - cantidadReservada when cantidadDisponible is absent', () => {
    // cantidadDisponible undefined → fallback to 40 - 5 = 35 > stockMinimo=10
    const item = makeItem({
      enAlerta: undefined as any,
      cantidadDisponible: undefined as any,
      cantidadActual: 40,
      cantidadReservada: 5,
      stockMinimo: 10,
    })
    const result = derivarEstadoAlerta(item)
    expect(result.enAlerta).toBe(false)
  })

  it('uses stockMinimo=10 as default when stockMinimo is absent', () => {
    const item = makeItem({
      enAlerta: undefined as any,
      cantidadDisponible: 8,
      stockMinimo: undefined as any,
    })
    // 8 <= 10 default → stockBajo
    const result = derivarEstadoAlerta(item)
    expect(result.stockBajo).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// filtrarSoloEnAlerta
// ─────────────────────────────────────────────────────────────────────────────

describe('filtrarSoloEnAlerta', () => {
  it('keeps only items with enAlerta=true', () => {
    const items = [
      makeItem({ id: 's1', enAlerta: true }),
      makeItem({ id: 's2', enAlerta: false }),
      makeItem({ id: 's3', enAlerta: true }),
    ]
    const result = filtrarSoloEnAlerta(items)
    expect(result).toHaveLength(2)
    expect(result.map((i) => i.id)).toEqual(['s1', 's3'])
  })

  it('returns empty array when no items are in alert', () => {
    const items = [makeItem({ enAlerta: false }), makeItem({ enAlerta: false })]
    expect(filtrarSoloEnAlerta(items)).toHaveLength(0)
  })

  it('returns all items when all are in alert', () => {
    const items = [makeItem({ enAlerta: true }), makeItem({ enAlerta: true })]
    expect(filtrarSoloEnAlerta(items)).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(filtrarSoloEnAlerta([])).toHaveLength(0)
  })

  it('does NOT include items where enAlerta is undefined', () => {
    // filtrarSoloEnAlerta uses strict === true, so undefined is excluded
    const items = [makeItem({ enAlerta: undefined as any })]
    expect(filtrarSoloEnAlerta(items)).toHaveLength(0)
  })
})
