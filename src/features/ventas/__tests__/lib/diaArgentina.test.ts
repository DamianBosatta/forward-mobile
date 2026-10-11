import { agruparPorDia, horaDe, tituloDelDia } from '../../lib/agruparPorDia'
import { fechaDesdePeriodo } from '../../hooks/useVentasListaNueva'

// El servidor interpreta las fechas como días de Argentina (UTC-3, sin horario de verano),
// sin importar el huso del teléfono. Los tests corren con TZ=UTC.
describe('días de Argentina en la lista de ventas', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-11T01:30:00Z')) // 22:30 del 10-10 en Argentina
  })
  afterEach(() => jest.useRealTimers())

  it('una venta de las 20:00 argentinas (23:00Z) es de "Hoy" aunque el teléfono ya esté en el día siguiente', () => {
    const secciones = agruparPorDia([{ f: '2026-10-10T23:00:00Z' }], (x) => x.f)
    expect(secciones.map((s) => s.titulo)).toEqual(['Hoy'])
  })

  it('una venta de las 21:00 argentinas del día anterior es de "Ayer"', () => {
    expect(tituloDelDia(new Date('2026-10-10T00:00:00Z'))).toBe('Ayer')
  })

  it('la hora de la tarjeta es la argentina', () => {
    expect(horaDe('2026-10-10T23:00:00Z')).toBe('20:00')
  })

  it('el período "Hoy" pide desde el día argentino', () => {
    expect(fechaDesdePeriodo('hoy')).toBe('2026-10-10')
    expect(fechaDesdePeriodo('7d')).toBe('2026-10-04')
    expect(fechaDesdePeriodo('todo')).toBeUndefined()
  })
})
