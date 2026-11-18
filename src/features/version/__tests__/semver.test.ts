import { compararVersiones, estaDesactualizada } from '../semver'

describe('compararVersiones', () => {
  it.each([
    ['1.0.0', '1.4.0', -1],
    ['1.4.0', '1.4.0', 0],
    ['1.10.0', '1.4.0', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.4.0-rc.1', '1.4.0', -1],
    ['1.4.0-rc.2', '1.4.0-rc.10', -1],
    ['1.4.0+build5', '1.4.0', 0],
    ['1.4', '1.4.0', null],
    ['abc', '1.4.0', null],
    ['', '1.4.0', null],
  ])('%s frente a %s da %s', (a, b, esperado) => {
    expect(compararVersiones(a, b)).toBe(esperado)
  })
})

describe('estaDesactualizada', () => {
  it('bloquea solo cuando la instalada es menor', () => {
    expect(estaDesactualizada('1.0.0', '1.4.0')).toBe(true)
    expect(estaDesactualizada('1.4.0', '1.4.0')).toBe(false)
    expect(estaDesactualizada('1.5.0', '1.4.0')).toBe(false)
  })
  it('nunca bloquea con un valor ausente o inválido', () => {
    expect(estaDesactualizada('1.0.0', null)).toBe(false)
    expect(estaDesactualizada('1.0.0', undefined)).toBe(false)
    expect(estaDesactualizada('1.0.0', 'cualquiera')).toBe(false)
    expect(estaDesactualizada(null, '1.4.0')).toBe(false)
    expect(estaDesactualizada('sin-version', '1.4.0')).toBe(false)
  })
})
