import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useInfiniteVentas, useVentasResumen } from '../ventas'
import { api } from '../client'

jest.mock('../client', () => ({ api: { get: jest.fn() }, API_URL: 'x' }))

const get = api.get as jest.Mock

function envoltorio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const consulta = (prefijo: string) => {
  const url = get.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith(prefijo))!
  return new URLSearchParams(url.split('?')[1])
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ items: [], page: 1, totalCount: 0, hasNextPage: false })
})

describe('filtros de ventas: lista y resumen', () => {
  const filtro = { tipoOperacion: 2, estados: ['EnPreparacion', 'Empacada'] as const, fechaDesde: '2026-10-01', searchTerm: 'luis' }

  it('`estados` va como clave repetida en GET /Ventas y en GET /Ventas/resumen, con los mismos filtros', async () => {
    const wrapper = envoltorio()
    renderHook(() => useInfiniteVentas({ pageSize: 20, ...filtro, estados: [...filtro.estados] }), { wrapper })
    renderHook(() => useVentasResumen({ ...filtro, estados: [...filtro.estados] }), { wrapper })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))

    const lista = consulta('/api/v1/Ventas?')
    const resumen = consulta('/api/v1/Ventas/resumen?')
    expect(lista.getAll('estados')).toEqual(['EnPreparacion', 'Empacada'])
    lista.delete('pageNumber'); lista.delete('pageSize')
    lista.sort(); resumen.sort()
    expect(resumen.toString()).toBe(lista.toString())
  })
})
