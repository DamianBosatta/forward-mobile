/**
 * VehiculoFormSheet — validation logic tests.
 *
 * Verifies the form blocks submission when:
 *   - Any required field is empty or whitespace-only
 *   - capacidadCargaKg is zero, negative, or non-numeric
 *
 * Uses the pure-function exports (validateVehiculoForm, isVehiculoFormValid)
 * so the suite is fast and avoids the heavy native-module mocking surface
 * required to render the modal end-to-end. Same pattern as
 * stock-action-modal-observacion.test.ts.
 */

import {
  validateVehiculoForm,
  isVehiculoFormValid,
} from '../../components/vehiculos/VehiculoFormSheet'

// ─────────────────────────────────────────────────────────────────────────────
// validateVehiculoForm — per-field error messages
// ─────────────────────────────────────────────────────────────────────────────

describe('validateVehiculoForm — required fields', () => {
  it('returns patente error when patente is empty', () => {
    const errors = validateVehiculoForm('', 'Ford Transit', '1500')
    expect(errors.patente).toBeDefined()
  })

  it('returns patente error when patente is whitespace only', () => {
    const errors = validateVehiculoForm('   ', 'Ford Transit', '1500')
    expect(errors.patente).toBeDefined()
  })

  it('returns modelo error when modelo is empty', () => {
    const errors = validateVehiculoForm('AB 123 CD', '', '1500')
    expect(errors.modelo).toBeDefined()
  })

  it('returns modelo error when modelo is whitespace only', () => {
    const errors = validateVehiculoForm('AB 123 CD', '   ', '1500')
    expect(errors.modelo).toBeDefined()
  })

  it('returns capacidadCargaKg error when capacidad is empty', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '')
    expect(errors.capacidadCargaKg).toBeDefined()
  })

  it('returns capacidadCargaKg error when capacidad is whitespace only', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '   ')
    expect(errors.capacidadCargaKg).toBeDefined()
  })

  it('returns no errors when all fields are valid', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '1500')
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateVehiculoForm — capacidadCargaKg boundary', () => {
  it('rejects capacidad = 0', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '0')
    expect(errors.capacidadCargaKg).toBeDefined()
  })

  it('rejects negative capacidad', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '-100')
    expect(errors.capacidadCargaKg).toBeDefined()
  })

  it('rejects non-numeric capacidad string', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', 'abc')
    expect(errors.capacidadCargaKg).toBeDefined()
  })

  it('accepts capacidad = 0.1 (just above 0)', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '0.1')
    expect(errors.capacidadCargaKg).toBeUndefined()
  })

  it('accepts capacidad = 1500', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '1500')
    expect(errors.capacidadCargaKg).toBeUndefined()
  })

  it('accepts decimal capacidad like 750.5', () => {
    const errors = validateVehiculoForm('AB 123 CD', 'Ford Transit', '750.5')
    expect(errors.capacidadCargaKg).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isVehiculoFormValid — submit guard (all-or-nothing)
// ─────────────────────────────────────────────────────────────────────────────

describe('isVehiculoFormValid — submit guard', () => {
  it('returns false when all fields are empty', () => {
    expect(isVehiculoFormValid('', '', '')).toBe(false)
  })

  it('returns false when only patente is missing', () => {
    expect(isVehiculoFormValid('', 'Ford Transit', '1500')).toBe(false)
  })

  it('returns false when only modelo is missing', () => {
    expect(isVehiculoFormValid('AB 123 CD', '', '1500')).toBe(false)
  })

  it('returns false when capacidad is 0', () => {
    expect(isVehiculoFormValid('AB 123 CD', 'Ford Transit', '0')).toBe(false)
  })

  it('returns false when capacidad is negative', () => {
    expect(isVehiculoFormValid('AB 123 CD', 'Ford Transit', '-1')).toBe(false)
  })

  it('returns false when capacidad is empty', () => {
    expect(isVehiculoFormValid('AB 123 CD', 'Ford Transit', '')).toBe(false)
  })

  it('returns true when all fields are valid', () => {
    expect(isVehiculoFormValid('AB 123 CD', 'Ford Transit', '1500')).toBe(true)
  })

  it('returns true with decimal capacidad', () => {
    expect(isVehiculoFormValid('XY 999 AB', 'Mercedes Sprinter', '2250.5')).toBe(true)
  })
})
