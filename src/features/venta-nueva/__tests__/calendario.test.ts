import { fechaEntregaPorDefecto, tiraDeDias, type CalendarioEntregas, type DiasDeEntrega } from '../lib/calendario'

/**
 * La fecha propuesta es la del servidor al crear una venta sin fecha:
 * `Venta.FechaEntregaPorDefecto(hoy, cal)` = `cal.ProximoDiaHabilitado(hoy + 1)` (Venta.cs:541-542):
 * el primer día con entregas desde mañana inclusive, con "hoy" en Argentina (UTC-3).
 */
const LUN_A_SAB: DiasDeEntrega = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: false }
const LUN_A_VIE: DiasDeEntrega = { ...LUN_A_SAB, sabado: false }
const TODOS: DiasDeEntrega = { ...LUN_A_SAB, domingo: true }
const SOLO_LUNES: DiasDeEntrega = { lunes: true, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false }
const SOLO_JUEVES: DiasDeEntrega = { ...SOLO_LUNES, lunes: false, jueves: true }

const cal = (dias: DiasDeEntrega | null, ...feriados: string[]): CalendarioEntregas =>
  ({ dias, feriados: feriados.map((fecha) => ({ fecha, descripcion: 'Feriado' })) })
// Mediodía en Argentina (15:00Z) del día pedido.
const ahora = (dia: string) => Date.parse(`${dia}T15:00:00Z`)

describe('fecha de entrega propuesta (igual que Venta.FechaEntregaPorDefecto)', () => {
  it('hoy habilitado: igual propone mañana, nunca hoy', () => {
    // Miércoles 7 de octubre de 2026, con todos los días habilitados.
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(TODOS))).toBe('2026-10-08')
  })

  it('un viernes con sábado y domingo deshabilitados propone el lunes', () => {
    expect(fechaEntregaPorDefecto(ahora('2026-10-16'), cal(LUN_A_VIE))).toBe('2026-10-19')
  })

  it('un feriado mañana se saltea', () => {
    // Miércoles 7: mañana (jueves 8) es feriado, se propone el viernes 9.
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(LUN_A_SAB, '2026-10-08'))).toBe('2026-10-09')
  })

  it('con lunes a sábado: el viernes propone el sábado y el sábado el lunes', () => {
    expect(fechaEntregaPorDefecto(ahora('2026-10-16'), cal(LUN_A_SAB))).toBe('2026-10-17')
    expect(fechaEntregaPorDefecto(ahora('2026-10-17'), cal(LUN_A_SAB))).toBe('2026-10-19')
  })

  it('un domingo feriado pegado al lunes feriado se cruza entero', () => {
    // Sábado 10: mañana es domingo (sin entregas) y el lunes 12 es feriado: martes 13.
    expect(fechaEntregaPorDefecto(ahora('2026-10-10'), cal(LUN_A_SAB, '2026-10-12'))).toBe('2026-10-13')
  })

  it('el feriado puede venir con hora, como lo manda el servidor', () => {
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(TODOS, '2026-10-08T00:00:00'))).toBe('2026-10-09')
  })

  it('"hoy" es el día de Argentina, no el del teléfono ni el UTC', () => {
    // Viernes 9 a las 23:30 en Argentina = sábado 10 a las 02:30Z: hoy es viernes, mañana sábado (hábil).
    expect(fechaEntregaPorDefecto(Date.parse('2026-10-10T02:30:00Z'), cal(LUN_A_SAB))).toBe('2026-10-10')
    // Sábado 10 a las 00:30 en Argentina = 03:30Z: hoy es sábado, mañana domingo sin entregas: lunes 12.
    expect(fechaEntregaPorDefecto(Date.parse('2026-10-10T03:30:00Z'), cal(LUN_A_SAB))).toBe('2026-10-12')
  })

  it('busca más allá de la tira de dos semanas, como el servidor (hasta 400 días)', () => {
    // Solo lunes y los tres lunes siguientes son feriado: el primero libre es el 2 de noviembre, a 26 días.
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(SOLO_LUNES, '2026-10-12', '2026-10-19', '2026-10-26'))).toBe('2026-11-02')
  })

  it('sin ningún día habilitado en 400 días (dato roto: el servidor falla) no propone ninguno', () => {
    const jueves = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 9, 8 + i * 7)).toISOString().slice(0, 10))
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(SOLO_JUEVES, ...jueves))).toBeNull()
  })

  it('sin los días de entrega cargados no adivina una fecha', () => {
    expect(fechaEntregaPorDefecto(ahora('2026-10-07'), cal(null))).toBeNull()
  })

  it('coincide con el primer día hábil de la tira cuando está dentro de las dos semanas', () => {
    const c = cal(LUN_A_VIE, '2026-10-12')
    const primero = tiraDeDias(ahora('2026-10-09'), c).find((d) => d.habil)
    expect(primero?.dia).toBe('2026-10-13')
    expect(fechaEntregaPorDefecto(ahora('2026-10-09'), c)).toBe(primero?.dia)
  })
})

describe('tira de días', () => {
  it('arranca mañana, tacha lo deshabilitado y nombra el feriado', () => {
    const tira = tiraDeDias(ahora('2026-10-09'), cal(LUN_A_SAB, '2026-10-12'), 4)
    expect(tira.map((d) => [d.dia, d.habil, d.feriado])).toEqual([
      ['2026-10-10', true, null],
      ['2026-10-11', false, null],
      ['2026-10-12', false, 'Feriado'],
      ['2026-10-13', true, null],
    ])
  })
})
