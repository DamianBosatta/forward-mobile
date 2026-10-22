import {
  diaCalendarioAMs, formatToLocalDate, formatToLocalTime, inicioDeDiaArgentinaMs, msHastaProximaMedianocheArgentina,
  primerDiaDelMesArgentina, rangoDelMes, sumarDiasADia,
} from '../date'

describe('msHastaProximaMedianocheArgentina', () => {
  it('a las 23:59:30 hora argentina faltan 30 s', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T02:59:30Z'))).toBe(30_000)
  })

  it('a las 00:00:00 hora argentina falta un día entero', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T03:00:00Z'))).toBe(24 * 60 * 60 * 1000)
  })

  it('a las 00:00:01 hora argentina falta un día menos 1 s', () => {
    expect(msHastaProximaMedianocheArgentina(Date.parse('2026-10-11T03:00:01Z'))).toBe(24 * 60 * 60 * 1000 - 1000)
  })
})

describe('formatToLocalTime / formatToLocalDate — siempre hora de Argentina, reloj de 24 h', () => {
  it('23:30 argentinas (02:30Z del día siguiente) se muestran en el día argentino', () => {
    expect(formatToLocalTime('2026-10-11T02:30:00Z')).toBe('10/10/2026 23:30')
    expect(formatToLocalDate('2026-10-11T02:30:00Z')).toBe('10/10/2026')
  })

  it('a las 15:05 argentinas (18:05Z) usa 24 h', () => {
    expect(formatToLocalTime('2026-10-10T18:05:00Z', 'dd/MM/yy HH:mm')).toBe('10/10/26 15:05')
  })

  it('un día calendario del backend no se corre un día', () => {
    expect(formatToLocalDate('2026-10-10')).toBe('10/10/2026')
    expect(formatToLocalTime('2026-10-10', 'dd/MM/yy')).toBe('10/10/26')
  })

  it('sin valor o inválido sigue diciendo "Sin registro"', () => {
    expect(formatToLocalTime(null)).toBe('Sin registro')
    expect(formatToLocalDate('no es fecha')).toBe('Sin registro')
  })
})

describe('días calendario de Argentina', () => {
  it('rangoDelMes: primer y último día, con febrero bisiesto', () => {
    expect(rangoDelMes(2026, 9)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(rangoDelMes(2028, 1)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(rangoDelMes(2026, 11)).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })

  it('primerDiaDelMesArgentina: 22:30 del 31-10 argentino (01:30Z del 1-11) sigue siendo octubre', () => {
    expect(primerDiaDelMesArgentina(Date.parse('2026-11-01T01:30:00Z'))).toBe('2026-10-01')
    expect(primerDiaDelMesArgentina(Date.parse('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })

  it('inicioDeDiaArgentinaMs: 00:00 argentina es 03:00Z', () => {
    expect(inicioDeDiaArgentinaMs('2026-10-01')).toBe(Date.parse('2026-10-01T03:00:00Z'))
  })

  it('sumarDiasADia cruza mes y año; diaCalendarioAMs rechaza días inexistentes', () => {
    expect(sumarDiasADia('2026-10-31', 1)).toBe('2026-11-01')
    expect(sumarDiasADia('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDiasADia('2026-03-01', -1)).toBe('2026-02-28')
    expect(diaCalendarioAMs('2026-02-30')).toBeNull()
    expect(diaCalendarioAMs('2026-2-3')).toBeNull()
    expect(diaCalendarioAMs('2026-10-10')).toBe(Date.UTC(2026, 9, 10))
  })
})
