/**
 * viajes-logic.test.ts
 *
 * Unit tests for the mirrored viajes-logic module.
 * Mirrors the web suite at forward-frontend/.../viajes-logic.test.ts.
 */

import {
  buildCrearHojaRutaPayload,
  reorderStop,
  assignOrderNumbers,
  ventasToOrderedStops,
  validateTripReadiness,
  allParadasReported,
  tripProgress,
  EstadoParada,
} from '../lib/viajes-logic'
import type { VentaEmpacada } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeVenta = (overrides: Partial<VentaEmpacada> = {}): VentaEmpacada => ({
  id: 'venta-1',
  clienteNombre: 'Cliente Test',
  direccion: 'Av. Siempreviva 742',
  latitude: -34.6,
  longitude: -58.4,
  cantidadBultos: 2,
  fechaEntrega: '2026-06-22T00:00:00Z',
  ...overrides,
})

// ─────────────────────────────────────────────────────────────────────────────
// buildCrearHojaRutaPayload
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCrearHojaRutaPayload', () => {
  it('includes depositoId in the output when provided', () => {
    const ventas = [makeVenta()]
    const fecha = new Date('2026-06-22T08:00:00Z')
    const payload = buildCrearHojaRutaPayload(ventas, 'chofer-1', 'vehiculo-1', fecha, 'deposito-abc')

    expect(payload.depositoId).toBe('deposito-abc')
    expect(payload.choferId).toBe('chofer-1')
    expect(payload.vehiculoId).toBe('vehiculo-1')
    expect(payload.paradas).toHaveLength(1)
    expect(payload.paradas[0].ventaId).toBe('venta-1')
  })

  it('sets depositoId to null when not provided', () => {
    const ventas = [makeVenta()]
    const payload = buildCrearHojaRutaPayload(ventas, 'c', 'v', new Date())
    expect(payload.depositoId).toBeNull()
  })

  it('maps venta coords to parada lat/lon', () => {
    const ventas = [makeVenta({ latitude: -34.9, longitude: -56.1 })]
    const payload = buildCrearHojaRutaPayload(ventas, 'c', 'v', new Date())
    expect(payload.paradas[0].latitud).toBe(-34.9)
    expect(payload.paradas[0].longitud).toBe(-56.1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// reorderStop
// ─────────────────────────────────────────────────────────────────────────────

describe('reorderStop', () => {
  const items = ['a', 'b', 'c']

  it('moves an item up', () => {
    expect(reorderStop(items, 1, 'up')).toEqual(['b', 'a', 'c'])
  })

  it('moves an item down', () => {
    expect(reorderStop(items, 1, 'down')).toEqual(['a', 'c', 'b'])
  })

  it('index 0 cannot move up — returns same array', () => {
    expect(reorderStop(items, 0, 'up')).toBe(items)
  })

  it('last index cannot move down — returns same array', () => {
    expect(reorderStop(items, 2, 'down')).toBe(items)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assignOrderNumbers
// ─────────────────────────────────────────────────────────────────────────────

describe('assignOrderNumbers', () => {
  it('renumbers stops from 1 sequentially', () => {
    const stops = [
      { ventaId: 'a', clienteNombre: 'A', direccion: '', cantidadBultos: 1 },
      { ventaId: 'b', clienteNombre: 'B', direccion: '', cantidadBultos: 1 },
      { ventaId: 'c', clienteNombre: 'C', direccion: '', cantidadBultos: 1 },
    ]
    const result = assignOrderNumbers(stops)
    expect(result.map((s) => s.orden)).toEqual([1, 2, 3])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ventasToOrderedStops
// ─────────────────────────────────────────────────────────────────────────────

describe('ventasToOrderedStops', () => {
  it('maps venta DTO to OrderedStop shape', () => {
    const ventas = [makeVenta({ id: 'v1', clienteNombre: 'Juan', direccion: 'Calle 1', cantidadBultos: 3 })]
    const stops = ventasToOrderedStops(ventas)

    expect(stops).toHaveLength(1)
    expect(stops[0].orden).toBe(1)
    expect(stops[0].ventaId).toBe('v1')
    expect(stops[0].clienteNombre).toBe('Juan')
    expect(stops[0].direccion).toBe('Calle 1')
    expect(stops[0].cantidadBultos).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateTripReadiness
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTripReadiness', () => {
  it('returns error when choferId is missing', () => {
    expect(validateTripReadiness(null, 'v1', [{}])).toMatch(/chofer/i)
  })

  it('returns error when vehiculoId is missing', () => {
    expect(validateTripReadiness('c1', null, [{}])).toMatch(/veh/i)
  })

  it('returns error when stops list is empty', () => {
    expect(validateTripReadiness('c1', 'v1', [])).toMatch(/parada/i)
  })

  it('returns null when all fields are present', () => {
    expect(validateTripReadiness('c1', 'v1', [{}])).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// allParadasReported
// ─────────────────────────────────────────────────────────────────────────────

describe('allParadasReported', () => {
  it('returns true when all stops have a terminal estado', () => {
    const paradas = [
      { estado: EstadoParada.Entregado },
      { estado: EstadoParada.NoEntregado },
    ]
    expect(allParadasReported(paradas)).toBe(true)
  })

  it('returns false when any stop is Pendiente', () => {
    const paradas = [
      { estado: EstadoParada.Entregado },
      { estado: EstadoParada.Pendiente },
    ]
    expect(allParadasReported(paradas)).toBe(false)
  })

  it('returns false when estado is null/undefined', () => {
    expect(allParadasReported([{ estado: null }, { estado: undefined }])).toBe(false)
  })

  it('returns true for empty list', () => {
    expect(allParadasReported([])).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tripProgress
// ─────────────────────────────────────────────────────────────────────────────

describe('tripProgress', () => {
  it('returns correct reported/total fraction', () => {
    const paradas = [
      { estado: EstadoParada.Entregado },
      { estado: EstadoParada.Pendiente },
      { estado: EstadoParada.NoEntregado },
    ]
    expect(tripProgress(paradas)).toEqual({ reported: 2, total: 3 })
  })

  it('returns 0/0 for empty list', () => {
    expect(tripProgress([])).toEqual({ reported: 0, total: 0 })
  })
})
