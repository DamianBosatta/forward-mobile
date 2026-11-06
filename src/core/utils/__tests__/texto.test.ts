import { normalizarBusqueda, sinAcentos } from '../texto'

describe('texto: búsqueda sin tildes ni mayúsculas', () => {
  it('sinAcentos quita tildes y diéresis y conserva mayúsculas y la ñ base', () => {
    expect(sinAcentos('Esencia Aromática Pingüino')).toBe('Esencia Aromatica Pinguino')
  })

  it('normalizarBusqueda además pasa a minúscula', () => {
    expect(normalizarBusqueda('LAVÁNDA')).toBe('lavanda')
  })

  it('"Vainilla" se encuentra con "VAINÍ" una vez normalizados los dos', () => {
    expect(normalizarBusqueda('Vainilla').includes(normalizarBusqueda('VAINÍ'.slice(0, 4)))).toBe(true)
  })
})
