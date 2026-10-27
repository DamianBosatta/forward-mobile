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
})
