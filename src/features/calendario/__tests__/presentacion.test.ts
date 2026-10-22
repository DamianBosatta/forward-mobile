import { diaDeLaSemana, esHoraValida, textoSemanal } from '../presentacion'

describe('presentación del calendario (9C)', () => {
  it('la hora es HH:mm de 00:00 a 23:59, o vacía (todo el día)', () => {
    for (const ok of ['', '00:00', '09:30', '23:59']) expect(esHoraValida(ok)).toBe(true)
    for (const mal of ['24:00', '9:30', '09:60', '0930', 'nueve']) expect(esHoraValida(mal)).toBe(false)
  })

  it('el día de la semana de una fecha no depende del huso del teléfono', () => {
    expect(diaDeLaSemana('2026-10-16')).toBe(5)
    expect(diaDeLaSemana('2026-11-01')).toBe(0)
  })

  it('"Se repite" se lee como la lámina, de lunes a domingo', () => {
    expect(textoSemanal([5])).toBe('Se repite todos los viernes')
    expect(textoSemanal([0, 1, 4])).toBe('Se repite todos los lunes, jueves y domingos')
    expect(textoSemanal([6])).toBe('Se repite todos los sábados')
    expect(textoSemanal([])).toBe('Se repite todas las semanas')
  })
})

describe('tipos de evento nuevo (T11)', () => {
  it('se ofrecen los mismos tres que la web, para todos', () => {
    const { TIPOS_MANUALES } = require('../presentacion')
    expect(TIPOS_MANUALES.map((t: { value: string }) => t.value)).toEqual(['ServicioRecurrente', 'ObligacionPeriodica', 'Manual'])
    expect(TIPOS_MANUALES.map((t: { label: string }) => t.label)).toEqual(['Servicio (luz, gas, internet…)', 'Obligación periódica (VTV, impuestos…)', 'Otro evento'])
  })
})
