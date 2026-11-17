import { enmascararFecha } from '../mascaras'
import { enmascararHora } from '../mascaras'

describe('enmascararFecha', () => {
  it.each([
    ['', ''], ['1', '1'], ['01', '01'], ['010', '01/0'], ['0102', '01/02'], ['01022', '01/02/2'],
    ['01022026', '01/02/2026'], ['01/02/2026', '01/02/2026'], ['010220261234', '01/02/2026'], ['a1b', '1'],
  ])('%j -> %j', (entrada, salida) => expect(enmascararFecha(entrada)).toBe(salida))
})

describe('enmascararHora', () => {
  it.each([['', ''], ['9', '9'], ['09', '09'], ['093', '09:3'], ['0930', '09:30'], ['09:30', '09:30'], ['093055', '09:30'], ['x', '']])(
    '%j -> %j', (entrada, salida) => expect(enmascararHora(entrada)).toBe(salida))
})
