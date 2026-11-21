import { formatearNumero } from '../numero'

describe('formatearNumero (es-AR)', () => {
  it('miles con punto y decimales con coma, hasta 2 por defecto', () => {
    expect(formatearNumero(2880)).toBe('2.880')
    expect(formatearNumero(12.345)).toBe('12,35')
  })
  it('permite fijar los decimales', () => {
    expect(formatearNumero(12.3, { minimo: 1, maximo: 1 })).toBe('12,3')
    expect(formatearNumero(1234.6, { maximo: 0 })).toBe('1.235')
  })
})
