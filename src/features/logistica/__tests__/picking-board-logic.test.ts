/**
 * picking-board-logic.test.ts
 *
 * Unit tests for the mirrored picking-board-logic module.
 * Mirrors the web suite at forward-frontend/.../picking-board.test.ts.
 */

import { partitionByEstado, validateCantidadBultos, ESTADO } from '../lib/picking-board-logic'
import type { VentaPreparacion } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeVenta = (estado: number, id = 'v1'): VentaPreparacion => ({
  id,
  clienteNombre: 'Test Cliente',
  direccion: 'Av. Test 123',
  fechaEntrega: null,
  estado,
  metodoEntrega: 1,
  itemsCount: 1,
  version: 1,
})

// ─────────────────────────────────────────────────────────────────────────────
// partitionByEstado
// ─────────────────────────────────────────────────────────────────────────────

describe('partitionByEstado', () => {
  it('correctly populates aPreparar, enPreparacion, and empacados buckets', () => {
    const ventas: VentaPreparacion[] = [
      makeVenta(ESTADO.A_PREPARAR, 'a'),
      makeVenta(ESTADO.EN_PREPARACION, 'b'),
      makeVenta(ESTADO.EMPACADOS, 'c'),
      makeVenta(ESTADO.A_PREPARAR, 'd'),
    ]

    const result = partitionByEstado(ventas)

    expect(result.aPreparar).toHaveLength(2)
    expect(result.aPreparar.map((v) => v.id)).toEqual(['a', 'd'])

    expect(result.enPreparacion).toHaveLength(1)
    expect(result.enPreparacion[0].id).toBe('b')

    expect(result.empacados).toHaveLength(1)
    expect(result.empacados[0].id).toBe('c')
  })

  it('silently excludes ventas with unknown estado values', () => {
    const ventas: VentaPreparacion[] = [
      makeVenta(99, 'unknown'),
      makeVenta(ESTADO.A_PREPARAR, 'known'),
    ]
    const result = partitionByEstado(ventas)
    expect(result.aPreparar).toHaveLength(1)
    expect(result.enPreparacion).toHaveLength(0)
    expect(result.empacados).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateCantidadBultos
// ─────────────────────────────────────────────────────────────────────────────

describe('validateCantidadBultos', () => {
  it('returns error on empty string', () => {
    expect(validateCantidadBultos('')).not.toBeNull()
  })

  it('returns error on blank/whitespace string', () => {
    expect(validateCantidadBultos('   ')).not.toBeNull()
  })

  it('returns error when value is 0', () => {
    expect(validateCantidadBultos('0')).not.toBeNull()
  })

  it('returns error when value is negative', () => {
    expect(validateCantidadBultos('-1')).not.toBeNull()
  })

  it('returns null for value ≥ 1', () => {
    expect(validateCantidadBultos('1')).toBeNull()
    expect(validateCantidadBultos('10')).toBeNull()
  })
})
