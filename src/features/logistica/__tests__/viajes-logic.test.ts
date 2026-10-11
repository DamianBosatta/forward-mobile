/**
 * viajes-logic.test.ts
 *
 * Unit tests for the mirrored viajes-logic module.
 * Mirrors the web suite at forward-frontend/.../viajes-logic.test.ts.
 */

import { allParadasReported, tripProgress, EstadoParada } from '../lib/viajes-logic'


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
