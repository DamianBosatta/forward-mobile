import { msHastaProximaMedianocheArgentina } from '../date'

describe('msHastaProximaMedianocheArgentina', () => {
  it('a las 23:59:30 hora argentina faltan 30 s', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T02:59:30Z'))).toBe(30_000)
  })

  it('a las 00:00:00 hora argentina falta un día entero', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T03:00:00Z'))).toBe(24 * 60 * 60 * 1000)
  })

  it('a las 00:00:01 hora argentina falta un día menos 1 s', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T03:00:01Z'))).toBe(24 * 60 * 60 * 1000 - 1000)
  })
})
