import { ddmmaaaa } from '../fecha'

describe('ddmmaaaa', () => {
  it('formats a plain ISO date as dd/mm/aaaa', () => {
    expect(ddmmaaaa('2026-11-02')).toBe('02/11/2026')
  })

  it('uses only the date part of an ISO datetime', () => {
    expect(ddmmaaaa('2026-11-02T23:30:00-03:00')).toBe('02/11/2026')
  })
})
