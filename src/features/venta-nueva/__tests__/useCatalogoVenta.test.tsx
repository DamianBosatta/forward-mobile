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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const escoba = producto({ id: 'p2', nombre: 'Escoba Rústica', codigoPropio: 'ESC1' })
const lavandina = producto({ id: 'p3', nombre: 'Lavandina Ácida', codigoPropio: 'LAV9' })

beforeEach(() => {
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

  it('busca en el catálogo completo, también lo que está en páginas lejanas, sin volver al servidor', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalogoVenta(q), { wrapper, initialProps: { q: '' } })
    await act(async () => {})
    await waitFor(() => expect(result.current.productos).toHaveLength(3))
    const llamadas = get.mock.calls.length
    rerender({ q: 'lav' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS - 1))
    expect(result.current.productos).toHaveLength(3)
    await act(async () => jest.advanceTimersByTime(1))
    expect(result.current.productos.map((p) => p.id)).toEqual(['p3'])
    expect(get.mock.calls).toHaveLength(llamadas)
    expect(get.mock.calls.some(([u]) => u.includes('SearchTerm'))).toBe(false)
  })

  it('la búsqueda ignora mayúsculas y tildes, y encuentra por código', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalogoVenta(q), { wrapper, initialProps: { q: '' } })
    await act(async () => {})
    await waitFor(() => expect(result.current.productos).toHaveLength(3))
    rerender({ q: 'ACIDA' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
    expect(result.current.productos.map((p) => p.id)).toEqual(['p3'])
    rerender({ q: 'rustica' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
    expect(result.current.productos.map((p) => p.id)).toEqual(['p2'])
    rerender({ q: 'esc1' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
    expect(result.current.productos.map((p) => p.id)).toEqual(['p2'])
  })
})
