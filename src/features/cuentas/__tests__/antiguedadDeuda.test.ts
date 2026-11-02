import { chipAntiguedadDeuda } from '../lib/antiguedadDeuda'

describe('chipAntiguedadDeuda', () => {
  it('más de 30 días: vencida, en peligro', () => {
    expect(chipAntiguedadDeuda(49)).toEqual({ tono: 'peligro', texto: 'Vencida · 49 días' })
    expect(chipAntiguedadDeuda(31)).toEqual({ tono: 'peligro', texto: 'Vencida · 31 días' })
  })
  it('hasta 30 días: deuda, en aviso; 1 en singular', () => {
    expect(chipAntiguedadDeuda(30)).toEqual({ tono: 'aviso', texto: 'Deuda de 30 días' })
    expect(chipAntiguedadDeuda(27)).toEqual({ tono: 'aviso', texto: 'Deuda de 27 días' })
    expect(chipAntiguedadDeuda(1)).toEqual({ tono: 'aviso', texto: 'Deuda de 1 día' })
  })
  it('0, null o sin dato: sin chip', () => {
    expect(chipAntiguedadDeuda(0)).toBeNull()
    expect(chipAntiguedadDeuda(null)).toBeNull()
    expect(chipAntiguedadDeuda(undefined)).toBeNull()
  })
})
