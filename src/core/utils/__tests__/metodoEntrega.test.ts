import { esRetiroEnLocal, etiquetaMetodo } from '../metodoEntrega'

describe('etiquetaMetodo', () => {
  it.each([
    [1, 'LogisticaPropia', 'Logística', 'Logística'],
    [2, 'RetiroEnLocal', 'Retiro', 'Retiro en el local'],
    [3, 'Expreso', 'Expreso', 'Expreso'],
  ])('método %s: forma corta y larga', (m, n, corta, larga) => {
    expect(etiquetaMetodo(m, n)).toBe(corta)
    expect(etiquetaMetodo(m, n, { larga: true })).toBe(larga)
  })
  it('sin número, resuelve por nombre', () => {
    expect(etiquetaMetodo(null, 'RetiroEnLocal', { larga: true })).toBe('Retiro en el local')
    expect(etiquetaMetodo(undefined, 'LogisticaPropia')).toBe('Logística')
  })
  it('método desconocido muestra el nombre', () => {
    expect(etiquetaMetodo(9, 'Drone')).toBe('Drone')
    expect(etiquetaMetodo(null, 'Drone', { larga: true })).toBe('Drone')
  })
  it('esRetiroEnLocal', () => {
    expect(esRetiroEnLocal(2)).toBe(true)
    expect(esRetiroEnLocal(null, 'RetiroEnLocal')).toBe(true)
    expect(esRetiroEnLocal(1, 'LogisticaPropia')).toBe(false)
    expect(esRetiroEnLocal(undefined, undefined)).toBe(false)
  })
})
