/**
 * step-confirm-validation.test.ts
 *
 * Tests that StepConfirm blocks "Iniciar viaje" when validateTripReadiness
 * returns errors. Uses the pure-function re-export from StepConfirm to keep
 * the test free of native module mocking while still verifying the component's
 * validation gate logic.
 *
 * Invariants:
 *   - validateTripReadiness blocks when choferId is null/empty
 *   - validateTripReadiness blocks when vehiculoId is null/empty
 *   - validateTripReadiness blocks when orderedStops is empty
 *   - validateTripReadiness returns null (ready) when all required fields are set
 */

import { validateTripReadinessForTest } from '../../components/viajes/StepConfirm'

const MOCK_STOP = {
  orden: 1,
  ventaId: 'venta-001',
  clienteNombre: 'Cliente Test',
  direccion: 'Av. Corrientes 1234',
  cantidadBultos: 2,
}

describe('StepConfirm — validateTripReadiness gate', () => {
  describe('blocks when required fields are missing', () => {
    it('returns error when choferId is null', () => {
      const result = validateTripReadinessForTest(null, 'vehiculo-001', [MOCK_STOP])
      expect(result).not.toBeNull()
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })

    it('returns error when choferId is empty string', () => {
      const result = validateTripReadinessForTest('', 'vehiculo-001', [MOCK_STOP])
      expect(result).not.toBeNull()
    })

    it('returns error when vehiculoId is null', () => {
      const result = validateTripReadinessForTest('chofer-001', null, [MOCK_STOP])
      expect(result).not.toBeNull()
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })

    it('returns error when vehiculoId is empty string', () => {
      const result = validateTripReadinessForTest('chofer-001', '', [MOCK_STOP])
      expect(result).not.toBeNull()
    })

    it('returns error when orderedStops is empty', () => {
      const result = validateTripReadinessForTest('chofer-001', 'vehiculo-001', [])
      expect(result).not.toBeNull()
      expect(typeof result).toBe('string')
    })

    it('returns error when all required fields are missing', () => {
      const result = validateTripReadinessForTest(null, null, [])
      expect(result).not.toBeNull()
    })
  })

  describe('allows submission when all required fields are present', () => {
    it('returns null when choferId, vehiculoId, and stops are all set', () => {
      const result = validateTripReadinessForTest('chofer-001', 'vehiculo-001', [MOCK_STOP])
      expect(result).toBeNull()
    })

    it('returns null with multiple stops', () => {
      const stops = [
        MOCK_STOP,
        { ...MOCK_STOP, orden: 2, ventaId: 'venta-002' },
        { ...MOCK_STOP, orden: 3, ventaId: 'venta-003' },
      ]
      const result = validateTripReadinessForTest('chofer-001', 'vehiculo-001', stops)
      expect(result).toBeNull()
    })
  })

  describe('error messages are descriptive', () => {
    it('chofer error message mentions chofer', () => {
      const result = validateTripReadinessForTest(null, 'vehiculo-001', [MOCK_STOP])
      expect(result?.toLowerCase()).toContain('chofer')
    })

    it('vehiculo error message mentions vehículo', () => {
      const result = validateTripReadinessForTest('chofer-001', null, [MOCK_STOP])
      // The message from viajes-logic.ts contains "vehículo" (with accent)
      expect(result?.toLowerCase()).toMatch(/veh/)
    })

    it('stops error mentions parada', () => {
      const result = validateTripReadinessForTest('chofer-001', 'vehiculo-001', [])
      expect(result?.toLowerCase()).toContain('parada')
    })
  })
})
