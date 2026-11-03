import { formatToLocalDate, formatToLocalTime, msHastaProximaMedianocheArgentina } from '../fecha'

describe('formatToLocalTime / formatToLocalDate (X9: Argentina calendar and clock on any device)', () => {
  it('a UTC instant renders the Argentina day', () => {
    expect(formatToLocalDate('2026-10-12T15:00:00Z')).toBe('12/10/2026')
  })

  it('an instant just after midnight UTC is still the previous Argentina day and hour', () => {
    expect(formatToLocalTime('2026-10-12T02:30:00Z')).toBe('11/10/2026 23:30')
  })

  it('an offset-less date-time is shown as written', () => {
    expect(formatToLocalTime('2026-10-12T09:15:00')).toBe('12/10/2026 09:15')
  })

  it('an explicit offset is an instant too', () => {
    expect(formatToLocalTime('2026-10-12T09:15:00-03:00')).toBe('12/10/2026 09:15')
  })

  it('null and invalid strings render "Sin registro"', () => {
    expect(formatToLocalTime(null)).toBe('Sin registro')
    expect(formatToLocalTime('no es fecha')).toBe('Sin registro')
  })
})

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
