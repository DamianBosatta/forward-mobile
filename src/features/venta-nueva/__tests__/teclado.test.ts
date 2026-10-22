import { cantidadDeTeclas, errorDeCantidad, teclear } from '../lib/teclado'

describe('teclado numérico de la cantidad', () => {
  it('suma dígitos y no empieza con cero', () => {
    expect(teclear('', '1')).toBe('1')
    expect(teclear('1', '2')).toBe('12')
    expect(teclear('0', '5')).toBe('5')
  })
  it('tiene tope de cuatro dígitos', () => {
    expect(teclear('1234', '5')).toBe('1234')
  })
  it('⌫ borra el último y C borra todo', () => {
    expect(teclear('123', 'del')).toBe('12')
    expect(teclear('123', 'clr')).toBe('')
    expect(teclear('', 'del')).toBe('')
  })
  it('lee la cantidad; vacío es cero', () => {
    expect(cantidadDeTeclas('12')).toBe(12)
    expect(cantidadDeTeclas('')).toBe(0)
  })
  it('la cantidad va de a la venta mínima y no puede ser cero', () => {
    expect(errorDeCantidad(0, 1)).toBe('Poné al menos una unidad.')
    expect(errorDeCantidad(10, 6)).toBe('Se vende de a 6: probá con 6 o 12.')
    expect(errorDeCantidad(12, 6)).toBeNull()
    expect(errorDeCantidad(7, 1)).toBeNull()
  })
})
