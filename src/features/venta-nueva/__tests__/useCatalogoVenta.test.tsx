import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/libs/api-client'
import { DEBOUNCE_BUSQUEDA_MS, useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { producto } from '../__testing__/producto'

jest.mock('@/libs/api-client', () => ({ api: { get: jest.fn() }, productosKeys: { all: ['productos'] } }))
const get = api.get as jest.Mock

const pagina = (items: ReturnType<typeof producto>[], page = 1, hasNextPage = false) => ({
  items, page, pageSize: 1000, totalCount: 3, totalPages: 2, hasNextPage,
})

let qc: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const escoba = producto({ id: 'p2', nombre: 'Escoba Rústica', codigoPropio: 'ESC1', marca: 'Bettanin', codigoProveedor: 'PRV-77' })
const lavandina = producto({ id: 'p3', nombre: 'Lavandina Ácida', codigoPropio: 'LAV9' })
// Una línea con fragancias: "lavanda" solo está en el nombre de una fragancia.
const linea = producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true })
const lavanda = producto({ id: 'pv1', nombre: 'Saphirus Aerosol - Lavanda', productoPadreId: 'pf', codigoBarra: '7790001' })
const coco = producto({ id: 'pv2', nombre: 'Saphirus Aerosol - Coco', productoPadreId: 'pf' })
const familia = [linea, lavanda, coco]
const todo = [escoba, lavandina, ...familia]

function diferido<T>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej })
  return { promesa, resolver, rechazar }
}

/** El catálogo completo responde `catalogo`; la búsqueda (`SearchTerm`), `buscar`. */
function servidor(catalogo: () => Promise<unknown>, buscar: (url: string) => Promise<unknown> = async () => pagina([])) {
  get.mockImplementation((url: string) => (url.includes('SearchTerm=') ? buscar(url) : catalogo()))
}
const sinCatalogo = () => Promise.reject(new Error('sin catálogo'))
const pidioBusqueda = () => get.mock.calls.some(([u]) => u.includes('SearchTerm='))

/** Monta el hook; `buscar` tipea un término, espera el debounce y deja correr las respuestas. */
async function montar() {
  jest.useFakeTimers()
  const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalogoVenta(q), { wrapper, initialProps: { q: '' } })
  await act(async () => {})
  const ids = () => result.current.productos.map((p) => p.id)
  const buscar = async (q: string) => {
    rerender({ q })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
    await act(async () => {})
  }
  return { ids, buscar, result }
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

  it('con el catálogo cargado busca en el teléfono por familias, sin ir al servidor: «lavanda» trae la línea', async () => {
    servidor(async () => pagina(todo))
    const { ids, buscar } = await montar()
    await buscar('lavanda')
    expect(ids()).toEqual(['pf', 'pv1', 'pv2'])
    expect(pidioBusqueda()).toBe(false)
  })

  it('en el teléfono: sin mayúsculas ni tildes, por código propio, de proveedor y de barras, y por marca', async () => {
    servidor(async () => pagina(todo))
    const { ids, buscar } = await montar()
    await buscar('ACIDA')
    expect(ids()).toEqual(['p3'])
    for (const q of ['rustica', 'esc1', 'bettanin', 'prv-77']) {
      await buscar(q)
      expect(ids()).toEqual(['p2'])
    }
    await buscar('7790001')
    expect(ids()).toEqual(['pf', 'pv1', 'pv2'])
  })

  it('sin el catálogo, pide SearchTerm y muestra la familia que devuelve el servidor', async () => {
    servidor(sinCatalogo, async () => pagina(familia))
    const { ids, buscar, result } = await montar()
    await buscar('lavanda')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(ids()).toEqual(['pf', 'pv1', 'pv2'])
    expect(get).toHaveBeenCalledWith('/api/v1/Productos/catalogo-stock?SearchTerm=lavanda&PageSize=1000')
  })

  it('servidor viejo (ignora SearchTerm y devuelve todo), sin el catálogo: quedan las familias que coinciden', async () => {
    servidor(sinCatalogo, async () => pagina(todo))
    const { ids, buscar, result } = await montar()
    await buscar('lavanda')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(pidioBusqueda()).toBe(true)
    expect(ids()).toEqual(['pf', 'pv1', 'pv2'])
  })

  it('con menos de 2 caracteres no va al servidor', async () => {
    servidor(sinCatalogo, async () => pagina(familia))
    const { ids, buscar } = await montar()
    await buscar('l')
    expect(pidioBusqueda()).toBe(false)
    expect(ids()).toEqual([])
  })

  it('con el catálogo truncado (20 páginas) la búsqueda va al servidor', async () => {
    servidor(async () => pagina([producto()], 1, true), async () => pagina(familia))
    const { ids, buscar, result } = await montar()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(20))
    await buscar('lavanda')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(ids()).toEqual(['pf', 'pv1', 'pv2'])
  })

  it('si el servidor respondió antes que el catálogo, al llegar el catálogo manda el catálogo', async () => {
    const catalogo = diferido<unknown>()
    servidor(() => catalogo.promesa, async () => pagina([linea, lavanda]))
    const { ids, buscar } = await montar()
    await buscar('lavanda')
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1']))
    await act(async () => catalogo.resolver(pagina(todo)))
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
  })

  it('si la búsqueda del servidor falló, al llegar el catálogo se busca en él', async () => {
    const catalogo = diferido<unknown>()
    servidor(() => catalogo.promesa, async () => { throw new Error('sin red') })
    const { ids, buscar } = await montar()
    await buscar('lavanda')
    await act(async () => catalogo.resolver(pagina(todo)))
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
  })

  it('mientras llega la respuesta de otro término sigue cargando: no dice que no hay', async () => {
    const segunda = diferido<unknown>()
    servidor(sinCatalogo, (url) => (url.includes('SearchTerm=escoba') ? Promise.resolve(pagina([escoba])) : segunda.promesa))
    const { ids, buscar, result } = await montar()
    await buscar('escoba')
    await waitFor(() => expect(ids()).toEqual(['p2']))
    await buscar('lavanda')
    expect(result.current.isLoading).toBe(true)
    await act(async () => segunda.resolver(pagina(familia)))
    await waitFor(() => expect(ids()).toEqual(['pf', 'pv1', 'pv2']))
    expect(result.current.isLoading).toBe(false)
  })
})
