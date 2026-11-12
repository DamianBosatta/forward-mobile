import { getCatalogoPdfUrl } from '../productos'

jest.mock('../client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn() } }))

describe('getCatalogoPdfUrl', () => {
  it('manda los mismos filtros que la pantalla y nada de más', () => {
    const url = new URL(getCatalogoPdfUrl({ search: 'sap aerosol', soloDisponibles: true, conOferta: true }))
    expect(url.origin + url.pathname).toBe('http://api.test/api/v1/catalogo/pdf')
    expect(url.searchParams.get('SearchTerm')).toBe('sap aerosol')
    expect(url.searchParams.get('SoloDisponibles')).toBe('true')
    expect(url.searchParams.get('ConOferta')).toBe('true')
    expect([...url.searchParams.keys()].sort()).toEqual(['ConOferta', 'SearchTerm', 'SoloDisponibles'])
  })

  it('sin filtros no agrega parámetros', () => {
    expect(getCatalogoPdfUrl({})).toBe('http://api.test/api/v1/catalogo/pdf')
    expect(getCatalogoPdfUrl({ search: '  ', soloDisponibles: false })).toBe('http://api.test/api/v1/catalogo/pdf')
  })

  it('manda lista de precios y descuentos repetidos, como la web', () => {
    const url = new URL(getCatalogoPdfUrl({ listaPrecioId: 'l1', formato: 'Lista', descuentos: [10, 20] }))
    expect([...url.searchParams.entries()]).toEqual([['ListaPrecioId', 'l1'], ['Formato', 'Lista'], ['Descuentos', '10'], ['Descuentos', '20']])
    expect(new URL(getCatalogoPdfUrl({ formato: 'Lista', sinDescuentos: true })).searchParams.get('SinDescuentos')).toBe('true')
  })

  it('el Informativo manda solo el formato', () => {
    const url = new URL(getCatalogoPdfUrl({ search: 'sap', soloDisponibles: true, conOferta: true, categoriaId: 'c', listaPrecioId: 'l1', formato: 'Informativo', novedadesDesde: '2026-10-12', descuentos: [5] }))
    expect([...url.searchParams.entries()]).toEqual([['Formato', 'Informativo']])
  })
})
