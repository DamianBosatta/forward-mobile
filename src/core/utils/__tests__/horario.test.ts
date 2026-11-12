import { agruparFranjas, expandirFilas, horaValida, textoHorario, validarFilas, type FilaHorario } from '../horario'

const f = (dia: number, desde: string, hasta: string) => ({ dia, desde, hasta })
const lunesAViernes = (desde: string, hasta: string) => [1, 2, 3, 4, 5].map(d => f(d, desde, hasta))

describe('agruparFranjas', () => {
  it('junta en una fila los días con el mismo desde y hasta', () => {
    expect(agruparFranjas(lunesAViernes('08:00', '12:00'))).toEqual([{ dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '12:00' }])
  })
  it('separa filas por rango y ordena los días con el lunes primero (domingo al final)', () => {
    const filas = agruparFranjas([f(0, '09:00', '13:00'), f(6, '09:00', '13:00'), f(1, '08:00', '12:00')])
    expect(filas).toEqual([
      { dias: [1], desde: '08:00', hasta: '12:00' },
      { dias: [6, 0], desde: '09:00', hasta: '13:00' },
    ])
  })
  it('normaliza horas con segundos y devuelve vacío sin franjas', () => {
    expect(agruparFranjas([f(1, '08:00:00', '12:00:00')])).toEqual([{ dias: [1], desde: '08:00', hasta: '12:00' }])
    expect(agruparFranjas(null)).toEqual([])
    expect(agruparFranjas([])).toEqual([])
  })
})

describe('expandirFilas', () => {
  it('abre cada fila en una franja por día y ordena por día', () => {
    const filas: FilaHorario[] = [{ dias: [3, 1], desde: '08:00', hasta: '12:00' }]
    expect(expandirFilas(filas)).toEqual([f(1, '08:00', '12:00'), f(3, '08:00', '12:00')])
  })
  it('es la inversa de agrupar', () => {
    const franjas = [...lunesAViernes('08:00', '12:00'), ...lunesAViernes('15:00', '19:00'), f(6, '09:00', '13:00')]
    expect(expandirFilas(agruparFranjas(franjas))).toEqual(
      [1, 2, 3, 4, 5].flatMap(d => [f(d, '08:00', '12:00'), f(d, '15:00', '19:00')]).concat(f(6, '09:00', '13:00')),
    )
  })
})

describe('textoHorario', () => {
  it('días consecutivos van con "a"', () => {
    expect(textoHorario(lunesAViernes('08:00', '12:00'))).toBe('L a V 08 a 12')
  })
  it('días salteados van con coma', () => {
    expect(textoHorario([f(1, '08:00', '12:00'), f(3, '08:00', '12:00'), f(5, '08:00', '12:00')])).toBe('L, X, V 08 a 12')
  })
  it('los minutos solo aparecen si no son cero', () => {
    expect(textoHorario([f(1, '08:30', '12:00')])).toBe('L 08:30 a 12')
    expect(textoHorario([f(2, '08:00', '12:15')])).toBe('M 08 a 12:15')
  })
  it('varios rangos en los mismos días se unen con " y "', () => {
    expect(textoHorario([...lunesAViernes('08:00', '12:00'), ...lunesAViernes('15:00', '19:00')])).toBe('L a V 08 a 12 y 15 a 19')
  })
  it('los grupos distintos se separan con " · "', () => {
    expect(textoHorario([...lunesAViernes('08:00', '12:00'), f(6, '09:00', '13:00')])).toBe('L a V 08 a 12 · S 09 a 13')
  })
  it('usa las letras L M X J V S D y el domingo cierra la semana', () => {
    expect(textoHorario([f(6, '09:00', '13:00'), f(0, '09:00', '13:00')])).toBe('S a D 09 a 13')
    expect(textoHorario([f(4, '08:00', '12:00')])).toBe('J 08 a 12')
  })
  it('sin franjas devuelve null', () => {
    expect(textoHorario([])).toBeNull()
    expect(textoHorario(null)).toBeNull()
  })
})

describe('horaValida', () => {
  it('acepta HH:mm y variantes cortas y devuelve HH:mm', () => {
    expect(horaValida('08:00')).toBe('08:00')
    expect(horaValida('8')).toBe('08:00')
    expect(horaValida('8:30')).toBe('08:30')
    expect(horaValida('1530')).toBe('15:30')
  })
  it('rechaza lo que no es una hora', () => {
    expect(horaValida('')).toBeNull()
    expect(horaValida('25:00')).toBeNull()
    expect(horaValida('12:75')).toBeNull()
    expect(horaValida('abc')).toBeNull()
  })
})

describe('validarFilas', () => {
  const ok: FilaHorario = { dias: [1], desde: '08:00', hasta: '12:00' }
  it('una fila correcta no tiene errores', () => {
    expect(validarFilas([ok])).toEqual([null])
  })
  it('pide al menos un día por fila', () => {
    expect(validarFilas([{ ...ok, dias: [] }])[0]).toBe('Elegí al menos un día.')
  })
  it('pide que "hasta" sea posterior a "desde" y que las horas sean válidas', () => {
    expect(validarFilas([{ ...ok, hasta: '08:00' }])[0]).toBe('«Hasta» tiene que ser después de «desde».')
    expect(validarFilas([{ ...ok, desde: '' }])[0]).toBe('Completá el horario con formato 08:00.')
  })
  it('marca las filas que se pisan en algún día', () => {
    const r = validarFilas([ok, { dias: [1, 2], desde: '11:00', hasta: '14:00' }])
    expect(r[0]).toBe('Se pisa con otro horario del mismo día.')
    expect(r[1]).toBe('Se pisa con otro horario del mismo día.')
  })
  it('rangos pegados o en días distintos no se pisan', () => {
    expect(validarFilas([ok, { dias: [1], desde: '12:00', hasta: '14:00' }, { dias: [2], desde: '08:00', hasta: '12:00' }])).toEqual([null, null, null])
  })
})
