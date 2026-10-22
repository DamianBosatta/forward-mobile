import { mesDe } from '../semana'

const OCT = Date.parse('2026-10-22T15:00:00Z')

describe('mes en grilla (TM10)', () => {
  it('octubre 2026 empieza un jueves: la grilla arranca el lunes 28 de septiembre y termina el domingo 1 de noviembre', () => {
    const m = mesDe(OCT)
    expect(m.titulo).toBe('Octubre 2026')
    expect(m.desde).toBe('2026-09-28')
    expect(m.hasta).toBe('2026-11-01')
    expect(m.semanas).toHaveLength(5)
    expect(m.semanas[0].map((d) => d.numero)).toEqual([28, 29, 30, 1, 2, 3, 4])
    expect(m.semanas[0].map((d) => d.delMes)).toEqual([false, false, false, true, true, true, true])
    expect(m.semanas[4][6]).toMatchObject({ fecha: '2026-11-01', delMes: false })
  })

  it('se mueve de a meses, también cruzando el año', () => {
    expect(mesDe(OCT, 1).titulo).toBe('Noviembre 2026')
    expect(mesDe(OCT, 3).titulo).toBe('Enero 2027')
    expect(mesDe(OCT, -10).titulo).toBe('Diciembre 2025')
  })

  it('un mes que empieza lunes y tiene 28 días ocupa cuatro semanas justas', () => {
    const m = mesDe(Date.parse('2027-02-10T15:00:00Z'))
    expect(m.semanas).toHaveLength(4)
    expect(m.desde).toBe('2027-02-01')
    expect(m.hasta).toBe('2027-02-28')
  })
})
