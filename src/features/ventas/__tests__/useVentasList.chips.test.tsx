import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useVentasList } from '../hooks/useVentasList'

// Lista de ventas de hoy con react-query de verdad: solo se simula el servidor.
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
jest.mock('@/libs/theme', () => ({ useColors: () => ({ primary: '#000', danger: '#f00', textMuted: '#999' }) }))

const venta = (id: string, estado: string) => ({ id, estado, totalAmount: 1000, fecha: '2026-10-01T12:00:00Z' })
const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })
const resumen = (cantidad: number) => ({ totalVendido: 3000, pendientes: 1, porAutorizar: 0, entregadas: 2, cantidad })

/** La respuesta de GET /Ventas con un estado elegido, que el test suelta cuando quiere. */
let soltarEntregadas: () => void = () => {}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockImplementation((url: string) => {
    const q = new URLSearchParams(url.split('?')[1])
    if (url.startsWith('/api/v1/Ventas/resumen?')) return Promise.resolve(resumen(q.getAll('estados').length ? 2 : 3))
    if (q.getAll('estados').includes('Entregada')) {
      return new Promise((r) => { soltarEntregadas = () => r(pagina([venta('b', 'Entregada'), venta('c', 'Entregada')])) })
    }
    return Promise.resolve(pagina([venta('a', 'Pendiente'), venta('b', 'Entregada'), venta('c', 'Entregada')]))
  })
})

function lista() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useVentasList(), { wrapper })
}

describe('lista de ventas de hoy: el chip de estado responde al instante', () => {
  it('filtra lo ya cargado sin volver a la carga inicial, sin contador hasta que contesta el servidor', async () => {
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe('Mostrando 3 de 3 · $ 3.000,00'))

    act(() => { result.current.setFilter('Entregada') })
    // Sin carga inicial el encabezado (y la fila de chips) no se remonta.
    expect(result.current.isLoading).toBe(false)
    expect(result.current.filteredVentas.map((v) => v.id)).toEqual(['b', 'c'])
    // Contador y ÓRDENES serían los del filtro anterior.
    expect(result.current.contador).toBeNull()
    expect(result.current.ordenes).toBeUndefined()

    await act(async () => { soltarEntregadas() })
    await waitFor(() => expect(result.current.contador).toBe('Mostrando 2 de 2 · $ 3.000,00'))
    expect(result.current.ordenes).toBe(2)
    expect(result.current.ordenesConFiltro).toBe(true)
  })

  it('cambiar de mes no deja a la vista las filas del mes anterior', async () => {
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe('Mostrando 3 de 3 · $ 3.000,00'))
    act(() => { result.current.setFilter('Entregada') })
    expect(result.current.filteredVentas).toHaveLength(2)

    act(() => { result.current.setSelected({ year: 2020, month: 0 }) })
    expect(result.current.filteredVentas).toHaveLength(0)
    expect(result.current.isLoading).toBe(true)
  })

  it('sin conexión el chip filtra lo ya cargado, como antes', async () => {
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe('Mostrando 3 de 3 · $ 3.000,00'))
    onlineManager.setOnline(false)
    try {
      act(() => { result.current.setFilter('Entregada') })
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(result.current.filteredVentas.map((v) => v.id)).toEqual(['b', 'c'])
      expect(result.current.contador).toBeNull()
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
