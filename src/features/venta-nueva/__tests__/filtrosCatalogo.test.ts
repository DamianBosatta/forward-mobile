import { filtrarCatalogo, FILTROS_VACIOS } from '../lib/filtrosCatalogo'
import { cajaDe6, producto } from '../__testing__/producto'

const a = producto({ id: 'a' })
const oferta = producto({ id: 'b', precioConOferta: 1800 })
const sinStock = cajaDe6({ id: 'c', puedeVenderse: false })
const todos = [a, oferta, sinStock]

describe('filtros del catálogo rápido', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrarCatalogo(todos, FILTROS_VACIOS, new Set())).toEqual(todos)
  })

  it('"Del último pedido" deja solo lo que llevó la última vez', () => {
    expect(filtrarCatalogo(todos, { ...FILTROS_VACIOS, delUltimo: true }, new Set(['c'])).map((p) => p.id)).toEqual(['c'])
  })

  it('"Con oferta" deja los que tienen precio con oferta vigente', () => {
    expect(filtrarCatalogo(todos, { ...FILTROS_VACIOS, conOferta: true }, new Set()).map((p) => p.id)).toEqual(['b'])
  })

  it('"Hay stock" deja los que el servidor dice que se pueden vender', () => {
    expect(filtrarCatalogo(todos, { ...FILTROS_VACIOS, hayStock: true }, new Set()).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('los filtros se combinan', () => {
    expect(filtrarCatalogo(todos, { delUltimo: true, conOferta: true, hayStock: false }, new Set(['a', 'b'])).map((p) => p.id)).toEqual(['b'])
  })

  it('una línea con fragancias entra por "Del último pedido" si el último llevó alguna de sus fragancias', () => {
    const padre = producto({ id: 'pf', esPadreDeVariantes: true })
    const var1 = producto({ id: 'v1', productoPadreId: 'pf' })
    expect(filtrarCatalogo([padre, var1], { ...FILTROS_VACIOS, delUltimo: true }, new Set(['v1'])).map((p) => p.id)).toContain('pf')
  })
})
