/**
 * MarcarPreparadoSheet — validation logic tests.
 *
 * Verifies the sheet blocks the empacar call when:
 *   - bultosStr is empty / whitespace-only → returns validation error
 *   - bultosStr is 0 or less              → returns validation error
 *   - bultosStr is valid (≥ 1)            → returns null (no error)
 *
 * Uses the re-exported validateBultosForTest (alias for validateCantidadBultos)
 * which is a pure function — no native module mocking required.
 * Same pattern as vehiculo-form-sheet.test.ts.
 */

import { validateBultosForTest } from '../../components/picking/MarcarPreparadoSheet'

// ─────────────────────────────────────────────────────────────────────────────
// validateBultosForTest — blocks the empacar call on 0 / blank
// ─────────────────────────────────────────────────────────────────────────────

describe('validateBultosForTest — blocks invalid inputs', () => {
  it('returns an error when bultosStr is empty', () => {
    expect(validateBultosForTest('')).not.toBeNull()
  })

  it('returns an error when bultosStr is whitespace only', () => {
    expect(validateBultosForTest('   ')).not.toBeNull()
  })

  it('returns an error when bultosStr is "0"', () => {
    expect(validateBultosForTest('0')).not.toBeNull()
  })

  it('returns an error when bultosStr is a negative number', () => {
    expect(validateBultosForTest('-1')).not.toBeNull()
  })

  it('returns an error when bultosStr is "-99"', () => {
    expect(validateBultosForTest('-99')).not.toBeNull()
  })

  it('returns an error when bultosStr is a non-numeric string', () => {
    expect(validateBultosForTest('abc')).not.toBeNull()
  })
})

describe('validateBultosForTest — allows valid inputs', () => {
  it('returns null for "1" (minimum valid value)', () => {
    expect(validateBultosForTest('1')).toBeNull()
  })

  it('returns null for "3"', () => {
    expect(validateBultosForTest('3')).toBeNull()
  })

  it('returns null for "10"', () => {
    expect(validateBultosForTest('10')).toBeNull()
  })

  it('returns null for "99"', () => {
    expect(validateBultosForTest('99')).toBeNull()
  })

  it('returns null for " 5 " (leading/trailing spaces around valid number)', () => {
    // trim() is applied before parseInt — " 5 " parses to 5 which is valid
    expect(validateBultosForTest(' 5 ')).toBeNull()
  })
})
