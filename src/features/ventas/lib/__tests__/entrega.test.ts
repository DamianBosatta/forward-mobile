import { diaDeEntregaCorto } from '../entrega'

describe('diaDeEntregaCorto', () => {
  it('shows the calendar day written in an offset-less string, whatever the device time zone', () => {
    expect(diaDeEntregaCorto('2026-10-22T00:00:00')).toBe('Jueves 22/10')
  })

  it('keeps converting a string with an offset to the Argentina day', () => {
    expect(diaDeEntregaCorto('2026-10-22T02:00:00Z')).toBe('Miércoles 21/10')
    expect(diaDeEntregaCorto('2026-10-22T02:00:00+00:00')).toBe('Miércoles 21/10')
  })

  it('returns null when there is no date', () => {
    expect(diaDeEntregaCorto(null)).toBeNull()
    expect(diaDeEntregaCorto(undefined)).toBeNull()
  })
})
