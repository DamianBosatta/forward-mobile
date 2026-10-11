import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useInfiniteCompras, useComprasResumen, type ComprasFiltroParams } from '@/libs/api-client/compras'
import { api } from '@/libs/api-client/client'

jest.mock('@/libs/api-client/client', () => ({
  api: { get: jest.fn() },
}))

const get = api.get as jest.Mock

function respuesta(url: string) {
  const mayo = url.includes('FechaDesde=2026-05')
  if (url.includes('/resumen')) {
    return Promise.resolve({ notasPedido: mayo ? 5 : 9 })
  }
  return Promise.resolve({
    items: [{ id: mayo ? 'mayo' : 'junio' }],
    totalCount: 1, page: 1, hasNextPage: false,
  })
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return wrapper
}

const mayo: ComprasFiltroParams = { fechaDesde: '2026-05-01', fechaHasta: '2026-05-31' }
const junio: ComprasFiltroParams = { fechaDesde: '2026-06-01', fechaHasta: '2026-06-30' }

describe('compras: datos previos al cambiar el filtro', () => {
  let resolver: (() => void)[]
  beforeEach(() => {
    get.mockReset()
    resolver = []
    get.mockImplementation((url: string) => {
      // las cargas del mes nuevo quedan pendientes hasta que el test las libere
      if (url.includes('2026-06') && resolver) {
        return new Promise(res => { resolver.push(() => res(respuesta(url))) })
      }
      return respuesta(url)
    })
  })

  it('cambiar de mes NO muestra las filas ni el resumen del mes anterior', async () => {
    const wrapper = setup()
    const { result, rerender } = renderHook(
      ({ p }: { p: ComprasFiltroParams }) => ({ lista: useInfiniteCompras(p), resumen: useComprasResumen(p) }),
      { wrapper, initialProps: { p: mayo } },
    )
    await waitFor(() => expect(result.current.lista.data?.pages[0].items[0].id).toBe('mayo'))
    await waitFor(() => expect(result.current.resumen.data?.notasPedido).toBe(5))

    rerender({ p: junio })

    expect(result.current.lista.data).toBeUndefined()
    expect(result.current.resumen.data).toBeUndefined()
    expect(result.current.lista.isLoading).toBe(true)

    await act(async () => { resolver.forEach(r => r()) })
    await waitFor(() => expect(result.current.lista.data?.pages[0].items[0].id).toBe('junio'))
  })

  it('cambiar solo la búsqueda del mismo mes conserva las filas previas', async () => {
    const wrapper = setup()
    const { result, rerender } = renderHook(
      ({ p }: { p: ComprasFiltroParams }) => ({ lista: useInfiniteCompras(p), resumen: useComprasResumen(p) }),
      { wrapper, initialProps: { p: mayo } },
    )
    await waitFor(() => expect(result.current.lista.data?.pages[0].items[0].id).toBe('mayo'))
    await waitFor(() => expect(result.current.resumen.data?.notasPedido).toBe(5))

    let liberar: () => void = () => {}
    get.mockImplementation((url: string) =>
      new Promise(res => { liberar = () => res(respuesta(url)) }))
    rerender({ p: { ...mayo, searchTerm: 'abc' } })

    expect(result.current.lista.data?.pages[0].items[0].id).toBe('mayo')
    expect(result.current.resumen.data?.notasPedido).toBe(5)
    await act(async () => { liberar() })
  })
})
