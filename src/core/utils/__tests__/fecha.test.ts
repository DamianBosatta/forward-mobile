import { ddmmaaaa, hoyTexto } from '@/core/utils/fecha'

describe('ddmmaaaa', () => {
  it('formats a plain ISO date as dd/mm/aaaa', () => {
    expect(ddmmaaaa('2026-11-02')).toBe('02/11/2026')
  })

  it('uses only the date part of an ISO datetime', () => {
    expect(ddmmaaaa('2026-11-02T23:30:00-03:00')).toBe('02/11/2026')
  })
})

describe('hoyTexto', () => {
  it('returns the Argentina calendar day as dd/mm/aaaa, not the UTC day', () => {
    // 2026-11-03 01:30 UTC is still 2026-11-02 22:30 in Argentina (UTC-3).
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 3, 1, 30))
    try {
      expect(hoyTexto()).toBe('02/11/2026')
    } finally {
      spy.mockRestore()
    }
  })
})

// P15: one short-date function for the whole app (it replaces three local copies).
import { fechaCorta } from '../fecha'

describe('fechaCorta', () => {
  it('writes a business day (AAAA-MM-DD) as day and month, as written, without a time zone shift', () => {
    expect(fechaCorta('2026-10-17')).toBe('17 oct')
    expect(fechaCorta('2026-01-01')).toBe('1 ene')
  })

  it('writes an instant with the Argentine calendar day, whatever the phone time zone', () => {
    expect(fechaCorta('2026-11-10T02:00:00Z')).toBe('9 nov')
    expect(fechaCorta('2026-11-09T15:00:00Z', 'semanaDiaMes')).toBe('lun 9/11')
  })

  it('writes the weekday style for a business day too', () => {
    expect(fechaCorta('2026-11-09', 'semanaDiaMes')).toBe('lun 9/11')
  })

  it('is an empty text when there is no valid date', () => {
    expect(fechaCorta('no es una fecha')).toBe('')
    expect(fechaCorta(null)).toBe('')
    expect(fechaCorta(undefined, 'semanaDiaMes')).toBe('')
  })
})
