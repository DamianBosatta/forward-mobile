import { buscarPorCodigoBarra, fetchCatalogoStockCompleto } from '../productos'
import { api } from '../client'

jest.mock('../client', () => ({ api: { get: jest.fn() } }))

const get = api.get as jest.Mock
const item = (id: string) => ({ id, nombre: id })

beforeEach(() => get.mockReset())

describe('fetchCatalogoStockCompleto', () => {
  it('junta los ítems de todas las páginas', async () => {
    get
      .mockResolvedValueOnce({ page: 1, totalPages: 2, hasNextPage: true, items: [item('a'), item('b')] })
      .mockResolvedValueOnce({ page: 2, totalPages: 2, hasNextPage: false, items: [item('c')] })

    const res = await fetchCatalogoStockCompleto('dep-1')

    expect(res.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[0][0]).toContain('pageNumber=1')
    expect(get.mock.calls[0][0]).toContain('pageSize=1000')
    expect(get.mock.calls[0][0]).toContain('depositoId=dep-1')
    expect(get.mock.calls[1][0]).toContain('pageNumber=2')
  })

  it('devuelve un arreglo vacío cuando items viene vacío o nulo', async () => {
    get.mockResolvedValueOnce({ page: 1, totalPages: 0, hasNextPage: false, items: [] })
    expect(await fetchCatalogoStockCompleto()).toEqual([])
    get.mockResolvedValueOnce({ page: 1, hasNextPage: false, items: null })
    expect(await fetchCatalogoStockCompleto()).toEqual([])
  })

  it('corta en el tope de páginas si el servidor nunca deja de decir hasNextPage', async () => {
    get.mockResolvedValue({ hasNextPage: true, items: [item('x')] })
    const res = await fetchCatalogoStockCompleto()
    expect(get).toHaveBeenCalledTimes(20)
    expect(res).toHaveLength(20)
  })
})

describe('buscarPorCodigoBarra (servidor viejo, que ignora CodigoBarra y devuelve el catálogo)', () => {
  const conCodigo = (id: string, codigoBarra: string) => ({ id, nombre: id, codigoBarra })

  it('sigue las páginas hasta encontrar el código exacto', async () => {
    get
      .mockResolvedValueOnce({ hasNextPage: true, items: [conCodigo('a', '77900000000240')] })
      .mockResolvedValueOnce({ hasNextPage: false, items: [conCodigo('b', '7790000000024')] })

    expect((await buscarPorCodigoBarra('7790000000024'))?.id).toBe('b')
    expect(get.mock.calls[1][0]).toBe('/api/v1/Productos/catalogo-stock?CodigoBarra=7790000000024&PageNumber=2&PageSize=1000')
  })

  it('corta en el tope de páginas y dice que no está', async () => {
    get.mockResolvedValue({ hasNextPage: true, items: [conCodigo('a', '1')] })
    expect(await buscarPorCodigoBarra('2')).toBeNull()
    expect(get).toHaveBeenCalledTimes(20)
  })
})
