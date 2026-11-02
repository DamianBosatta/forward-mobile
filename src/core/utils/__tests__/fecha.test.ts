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
