import { rangoDelPeriodo } from '../lib/periodo'

// 2026-10-30 12:00 en Argentina (UTC-3) = 15:00 UTC
const ahora = Date.UTC(2026, 9, 30, 15, 0)

describe('rangoDelPeriodo (día de negocio argentino)', () => {
  it('mes actual: del 1 a hoy', () => {
    expect(rangoDelPeriodo('mesActual', ahora)).toEqual({ desde: '2026-10-01', hasta: '2026-10-30' })
  })

  it('mes anterior: del 1 al último día', () => {
    expect(rangoDelPeriodo('mesAnterior', ahora)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
  })

  it('mes anterior en enero cruza el año', () => {
    expect(rangoDelPeriodo('mesAnterior', Date.UTC(2027, 0, 15, 15))).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })

  it('mes anterior de marzo respeta febrero', () => {
    expect(rangoDelPeriodo('mesAnterior', Date.UTC(2027, 2, 10, 15))).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' })
  })

  it('últimos 90 días: hoy y los 89 anteriores', () => {
    expect(rangoDelPeriodo('ultimos90', ahora)).toEqual({ desde: '2026-08-02', hasta: '2026-10-30' })
  })

  it('a las 01:00 UTC todavía es el día anterior en Argentina', () => {
    expect(rangoDelPeriodo('mesActual', Date.UTC(2026, 10, 1, 1, 0))).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })
})
