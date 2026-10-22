import { puedePedirCambio, sensiblesBloqueados } from '../lib/camposSensibles'

const guardado = { razonSocial: 'Graciela Ruiz', cuit: '27-24389156-3', direccion: 'Av. del Valle 89' }

describe('sensiblesBloqueados (misma regla que la web)', () => {
  it('un administrador edita todo', () => {
    expect(sensiblesBloqueados(true, true, guardado)).toEqual({ razonSocial: false, cuit: false, direccion: false })
  })

  it('un no administrador en edición ve bloqueados razón social, CUIT y dirección', () => {
    expect(sensiblesBloqueados(false, true, guardado)).toEqual({ razonSocial: true, cuit: true, direccion: true })
  })

  it('en el alta no se bloquea nada', () => {
    expect(sensiblesBloqueados(false, false)).toEqual({ razonSocial: false, cuit: false, direccion: false })
  })

  it('completar un hueco no requiere trámite: CUIT o dirección vacíos quedan editables', () => {
    expect(sensiblesBloqueados(false, true, { ...guardado, cuit: ' ', direccion: null })).toMatchObject({ cuit: false, direccion: false })
  })
})

describe('puedePedirCambio', () => {
  it.each([
    [false, true, true],
    [true, true, false],
    [false, false, false],
  ])('esAdmin=%s puedeEditar=%s → %s', (esAdmin, puedeEditar, esperado) => {
    expect(puedePedirCambio(esAdmin, puedeEditar)).toBe(esperado)
  })
})
