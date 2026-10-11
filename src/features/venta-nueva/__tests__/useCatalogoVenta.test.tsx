import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/libs/api-client'
import { DEBOUNCE_BUSQUEDA_MS, useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { producto } from '../__testing__/producto'

jest.mock('@/libs/api-client', () => ({ api: { get: jest.fn() }, productosKeys: { all: ['productos'] } }))
const get = api.get as jest.Mock

const pagina = (items: ReturnType<typeof producto>[], hasNextPage = false) => ({
  items, page: 1, pageSize: 30, totalCount: 31, totalPages: 2, hasNextPage,
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue(pagina([producto(), producto({ id: 'p2', nombre: 'Escoba', codigoPropio: 'ESC1' })], true))
})
afterEach(() => jest.useRealTimers())

describe('useCatalogoVenta', () => {
  it('pide la primera página del catálogo de venta paginado en el servidor', async () => {
    const { result } = renderHook(() => useCatalogoVenta(''), { wrapper })
    await waitFor(() => expect(result.current.productos).toHaveLength(2))
    expect(get).toHaveBeenCalledWith('/api/v1/Productos/catalogo-stock?PageNumber=1&PageSize=30')
    expect(result.current.hayMas).toBe(true)
  })

  it('la búsqueda va al servidor recién cuando se deja de tipear (debounce)', async () => {
    jest.useFakeTimers()
    const { rerender } = renderHook(({ q }: { q: string }) => useCatalogoVenta(q), { wrapper, initialProps: { q: '' } })
    await act(async () => {})
    rerender({ q: 'pa' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS / 2))
    rerender({ q: 'pala' })
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS - 1))
    expect(get.mock.calls.some(([url]) => url.includes('SearchTerm'))).toBe(false)
    await act(async () => jest.advanceTimersByTime(1))
    await waitFor(() => expect(get.mock.calls.filter(([url]) => url.includes('SearchTerm'))).toEqual([
      ['/api/v1/Productos/catalogo-stock?PageNumber=1&PageSize=30&SearchTerm=pala'],
    ]))
  })

  it('cargarMas pide la página siguiente', async () => {
    const { result } = renderHook(() => useCatalogoVenta(''), { wrapper })
    await waitFor(() => expect(result.current.hayMas).toBe(true))
    act(() => result.current.cargarMas())
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/Productos/catalogo-stock?PageNumber=2&PageSize=30'))
  })
})
