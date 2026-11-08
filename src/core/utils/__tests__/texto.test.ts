import { coincidePalabras, normalizarBusqueda, sinAcentos } from '../texto'

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

describe('coincidePalabras (búsqueda de productos: palabras con Y)', () => {
  const campos = ['Esencia Lavanda', 'Aromas del Sur', 'LAV-01', null, '7791234']

  it('con la consulta vacía coincide todo', () => {
    expect(coincidePalabras(campos, '')).toBe(true)
    expect(coincidePalabras(campos, '   ')).toBe(true)
  })

  it('todas las palabras tienen que aparecer, cada una en algún campo', () => {
    expect(coincidePalabras(campos, 'lavanda aromas')).toBe(true)
    expect(coincidePalabras(campos, 'lavanda lav-01')).toBe(true)
    expect(coincidePalabras(campos, 'lavanda rosas')).toBe(false)
  })

  it('no distingue tildes ni mayúsculas', () => {
    expect(coincidePalabras(['Esencia aromática'], 'AROMATICA esencia')).toBe(true)
    expect(coincidePalabras(['Esencia aromatica'], 'aromática')).toBe(true)
  })

  it('busca en cualquiera de los campos y tolera nulos', () => {
    expect(coincidePalabras(campos, '779123')).toBe(true)
    expect(coincidePalabras(campos, 'sur')).toBe(true)
    expect(coincidePalabras([null, undefined], 'x')).toBe(false)
  })

  it('el orden de las palabras no importa', () => {
    expect(coincidePalabras(campos, 'sur lavanda')).toBe(true)
  })
})
