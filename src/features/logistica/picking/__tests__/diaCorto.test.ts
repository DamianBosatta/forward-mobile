import { diaCorto } from '../tablero'

// Pins what the board card prints for the delivery day (P15: the copy migrates to core/utils/fecha).
describe('diaCorto del tablero', () => {
  it('prints weekday and day/month of the Argentine calendar day', () => {
    expect(diaCorto('2026-11-09T15:00:00Z')).toBe('lun 9/11')
    expect(diaCorto('2026-12-01T12:00:00Z')).toBe('mar 1/12')
  })

  it('does not move the day by the phone time zone: 23:00 in Argentina is still the same day', () => {
    expect(diaCorto('2026-11-10T02:00:00Z')).toBe('lun 9/11')
  })

  it('is null when the date is not valid', () => {
    expect(diaCorto('no es una fecha')).toBeNull()
  })
})
