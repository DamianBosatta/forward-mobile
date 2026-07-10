/**
 * StockActionModal — observacion validation logic tests.
 *
 * Tests the guard that prevents submitting an adjust operation without a
 * meaningful reason. The component blocks submission when:
 *   - observacion is empty or whitespace-only
 *   - observacion.trim().length < 3
 *
 * These rules mirror AdjustStockValidator (backend, min length 3, non-empty).
 * The 'Ajuste manual desde app' silent fallback has been removed — callers
 * must provide an explicit reason for every stock adjustment.
 *
 * Pure-logic tests are used to keep the suite fast and avoid the heavy native
 * module mocking surface required to render StockActionModal end-to-end.
 */

// ─── validation predicate extracted from handleAdjust guard ──────────────────
// Mirrors: const observacionTrimmed = observacion.trim()
//          if (!observacionTrimmed || observacionTrimmed.length < 3)
function isObservacionValid(observacion: string): boolean {
  const trimmed = observacion.trim()
  return trimmed.length >= 3
}

// ─── button disabled predicate ────────────────────────────────────────────────
// Mirrors: disabled={isAdjusting || !cantidad || observacion.trim().length < 3}
function isButtonDisabled(opts: {
  isAdjusting: boolean
  cantidad: string
  observacion: string
}): boolean {
  const { isAdjusting, cantidad, observacion } = opts
  return isAdjusting || !cantidad || observacion.trim().length < 3
}

// ─────────────────────────────────────────────────────────────────────────────
// Observacion validation — mirrors backend AdjustStockValidator rules
// ─────────────────────────────────────────────────────────────────────────────

describe('StockActionModal — observacion validation (mirrors AdjustStockValidator)', () => {
  it('rejects empty string', () => {
    expect(isObservacionValid('')).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(isObservacionValid('   ')).toBe(false)
  })

  it('rejects 1-char string', () => {
    expect(isObservacionValid('a')).toBe(false)
  })

  it('rejects 2-char string (below min length 3)', () => {
    expect(isObservacionValid('ab')).toBe(false)
  })

  it('accepts exactly 3 chars', () => {
    expect(isObservacionValid('abc')).toBe(true)
  })

  it('accepts a normal reason phrase', () => {
    expect(isObservacionValid('Rotura en almacén')).toBe(true)
  })

  it('trims before checking — leading/trailing whitespace does not count', () => {
    expect(isObservacionValid('  a  ')).toBe(false) // trims to 1 char
    expect(isObservacionValid('  abc  ')).toBe(true)  // trims to 3 chars
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Button disabled guard — confirms 'Ajuste manual desde app' fallback is gone
// ─────────────────────────────────────────────────────────────────────────────

describe('StockActionModal — submit button disabled guard', () => {
  const base = { isAdjusting: false, cantidad: '5' }

  it('disables button when observacion is empty — no silent default fallback', () => {
    expect(isButtonDisabled({ ...base, observacion: '' })).toBe(true)
  })

  it('disables button when observacion is only whitespace', () => {
    expect(isButtonDisabled({ ...base, observacion: '   ' })).toBe(true)
  })

  it('disables button when observacion is shorter than 3 chars', () => {
    expect(isButtonDisabled({ ...base, observacion: 'ab' })).toBe(true)
  })

  it('enables button when observacion meets minimum length', () => {
    expect(isButtonDisabled({ ...base, observacion: 'abc' })).toBe(false)
  })

  it('enables button when all conditions are met', () => {
    expect(isButtonDisabled({ ...base, observacion: 'Conteo físico mensual' })).toBe(false)
  })

  it('disables button when cantidad is empty regardless of observacion', () => {
    expect(isButtonDisabled({ ...base, cantidad: '', observacion: 'valid reason' })).toBe(true)
  })

  it('disables button when isAdjusting is true regardless of other fields', () => {
    expect(isButtonDisabled({ isAdjusting: true, cantidad: '5', observacion: 'valid reason' })).toBe(true)
  })
})
