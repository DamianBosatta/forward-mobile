import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/libs/api-client'
import { DEBOUNCE_BUSQUEDA_MS, useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { producto } from '../__testing__/producto'

jest.mock('@/libs/api-client', () => ({ api: { get: jest.fn() }, productosKeys: { all: ['productos'] } }))
const get = api.get as jest.Mock

const pagina = (items: ReturnType<typeof producto>[], page: number, hasNextPage: boolean) => ({
  items, page, pageSize: 1000, totalCount: 3, totalPages: 2, hasNextPage,
})

let qc: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const escoba = producto({ id: 'p2', nombre: 'Escoba Rústica', codigoPropio: 'ESC1', marca: 'Bettanin' })
const lavandina = producto({ id: 'p3', nombre: 'Lavandina Ácida', codigoPropio: 'LAV9' })
// Una línea con fragancias: "lavanda" solo está en el nombre de una fragancia.
const linea = producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true })
const lavanda = producto({ id: 'pv1', nombre: 'Saphirus Aerosol - Lavanda', productoPadreId: 'pf', codigoBarra: '7790001' })
const coco = producto({ id: 'pv2', nombre: 'Saphirus Aerosol - Coco', productoPadreId: 'pf' })
const familia = [linea, lavanda, coco]

/** Catálogo completo en una página; la búsqueda responde lo que diga `buscar`. */
function servidor(buscar: (url: string) => Promise<unknown>) {
  get.mockImplementation(async (url: string) =>
    url.includes('SearchTerm=') ? buscar(url) : pagina([escoba, lavandina, ...familia], 1, false))
}

/** Monta el hook con el catálogo cargado; `buscar` tipea un término y espera el debounce. */
async function montar() {
  jest.useFakeTimers()
  const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalogoVenta(q), { wrapper, initialProps: { q: '' } })
  await act(async () => {})
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  const ids = () => result.current.productos.map((p) => p.id)
  const buscar = async (q: string) => {
    rerender({ q })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
  }
  return { ids, buscar }
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  get.mockReset()
  get.mockImplementation(async (url: string) =>
    url.includes('PageNumber=2') ? pagina([lavandina], 2, false) : pagina([producto(), escoba], 1, true),
  )
})
afterEach(() => jest.useRealTimers())

describe('useCatalogoVenta', () => {
  it('carga el catálogo completo: páginas de 1000 hasta que no haya más', async () => {
    const { result } = renderHook(() => useCatalogoVenta(''), { wrapper })
    await waitFor(() => expect(result.current.productos).toHaveLength(3))
    expect(get.mock.calls.map(([u]) => u)).toEqual([
      '/api/v1/Productos/catalogo-stock?PageNumber=1&PageSize=1000',
      '/api/v1/Productos/catalogo-stock?PageNumber=2&PageSize=1000',
    ])
  })

  it('corta en 20 páginas aunque el servidor siga diciendo que hay más', async () => {
    get.mockImplementation(async () => pagina([producto()], 1, true))
    const { result } = renderHook(() => useCatalogoVenta(''), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(get).toHaveBeenCalledTimes(20)
  })

  it('servidor que busca: pide el término tras el debounce y muestra la familia que devuelve (la línea incluida)', async () => {
    // El catálogo cargado antes no tenía la línea: lo que se ve es la respuesta de la búsqueda.
    get.mockImplementation(async (url: string) => (url.includes('SearchTerm=') ? pagina(familia, 1, false) : pagina([escoba], 1, false)))
    const { ids, buscar } = await montar()
    await buscar('lavanda')
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
    expect(get).toHaveBeenCalledWith('/api/v1/Productos/catalogo-stock?SearchTerm=lavanda&PageSize=1000')
  })

  it('servidor viejo (ignora SearchTerm y devuelve todo): quedan las familias que coinciden, con su línea', async () => {
    servidor(async () => pagina([escoba, lavandina, ...familia], 1, false))
    const { ids, buscar } = await montar()
    await buscar('lavanda')
    await waitFor(() => expect(get.mock.calls.some(([u]) => u.includes('SearchTerm=lavanda'))).toBe(true))
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
  })

  it('sin conexión (la búsqueda falla): busca en el catálogo ya cargado, también por el código de barras de una fragancia', async () => {
    servidor(async () => { throw new Error('sin red') })
    const { ids, buscar } = await montar()
    await buscar('7790001')
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
  })

  it('si la respuesta no entra en una página, busca en el catálogo completo (también lo de páginas lejanas)', async () => {
    const { ids, buscar } = await montar()
    await buscar('lav')
    await waitFor(() => expect(get.mock.calls.some(([u]) => u.includes('SearchTerm=lav'))).toBe(true))
    await waitFor(() => expect(ids()).toEqual(['p3']))
  })

  it('lo que se filtra en el teléfono ignora mayúsculas y tildes, y encuentra por código y por marca', async () => {
    servidor(async () => pagina([escoba, lavandina], 1, false))
    const { ids, buscar } = await montar()
    await buscar('ACIDA')
    await waitFor(() => expect(ids()).toEqual(['p3']))
    for (const q of ['rustica', 'esc1', 'bettanin']) {
      await buscar(q)
      await waitFor(() => expect(ids()).toEqual(['p2']))
    }
  })
})
