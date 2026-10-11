import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useVentasList } from '../hooks/useVentasList'

// Lista de ventas de hoy con react-query de verdad: solo se simula el servidor (el nuevo, que
// filtra por `estados`).
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
jest.mock('@/libs/theme', () => ({ useColors: () => ({ primary: '#000', danger: '#f00', textMuted: '#999' }) }))

const VENTAS = [{ id: 'a', estado: 'Pendiente' }, { id: 'b', estado: 'Entregada' }, { id: 'c', estado: 'Entregada' }]
const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })
/** Un mes que no es el actual (la lista arranca en el actual). */
const OTRO_MES = { year: 2020, month: 0 }
const esOtroMes = (q: URLSearchParams) => q.get('fechaDesde')!.startsWith('2020-01')

/** Consultas de GET /Ventas que el servidor deja sin contestar (la lista queda cargando). */
let retener: (q: URLSearchParams) => boolean
let soltar: () => void = () => {}

beforeEach(() => {
  mockGet.mockReset()
  retener = () => false
  mockGet.mockImplementation((url: string) => {
    const q = new URLSearchParams(url.split('?')[1])
    const estados = q.getAll('estados')
    const filas = VENTAS.filter((v) => estados.length === 0 || estados.includes(v.estado)).map((v) => ({ ...v, totalAmount: 1000 }))
    if (url.startsWith('/api/v1/Ventas/resumen?')) {
      return Promise.resolve({ totalVendido: 3000, pendientes: 1, porAutorizar: 0, entregadas: 2, cantidad: filas.length })
    }
    if (retener(q)) return new Promise((r) => { soltar = () => r(pagina(filas)) })
    return Promise.resolve(pagina(filas))
  })
})

function lista() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useVentasList(), { wrapper })
}
const ids = (r: { current: ReturnType<typeof useVentasList> }) => r.current.filteredVentas.map((v) => v.id)
const TODAS = 'Mostrando 3 de 3 · $ 3.000,00'
const ENTREGADAS = 'Mostrando 2 de 2 · $ 3.000,00'

describe('lista de ventas de hoy: el chip de estado responde al instante', () => {
  it('filtra lo de "Todas" sin volver a la carga inicial, sin contador ni spinner hasta que contesta el servidor', async () => {
    retener = (q) => q.getAll('estados').includes('Entregada')
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe(TODAS))

    act(() => { result.current.setFilter('Entregada') })
    // Sin carga inicial el encabezado (y la fila de chips) no se remonta.
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isRefetching).toBe(false)
    expect(ids(result)).toEqual(['b', 'c'])
    // Contador y ÓRDENES serían los del filtro anterior.
    expect(result.current.contador).toBeNull()
    expect(result.current.ordenes).toBeUndefined()

    await act(async () => { soltar() })
    await waitFor(() => expect(result.current.contador).toBe(ENTREGADAS))
    expect(result.current.ordenes).toBe(2)
    expect(result.current.ordenesConFiltro).toBe(true)
  })

  it('de un chip a otro la vista previa sale de "Todas", no del chip anterior', async () => {
    retener = (q) => q.getAll('estados').includes('Pendiente')
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe(TODAS))
    act(() => { result.current.setFilter('Entregada') })
    await waitFor(() => expect(result.current.contador).toBe(ENTREGADAS))

    act(() => { result.current.setFilter('Pendiente') })
    expect(ids(result)).toEqual(['a'])
    expect(result.current.isLoading).toBe(false)
  })

  it('con un chip, cambiar de mes y tocar "Todas" no muestra lo del chip: sin "Todas" de ese mes, se ve la carga', async () => {
    retener = (q) => q.getAll('estados').length === 0 && esOtroMes(q)
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe(TODAS))
    act(() => { result.current.setFilter('Entregada') })
    await waitFor(() => expect(result.current.contador).toBe(ENTREGADAS))
    act(() => { result.current.setSelected(OTRO_MES) })
    await waitFor(() => expect(result.current.contador).toBe(ENTREGADAS))

    act(() => { result.current.setFilter('Todas') })
    expect(ids(result)).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('cambiar de mes no deja a la vista las filas del mes anterior', async () => {
    retener = esOtroMes
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe(TODAS))
    act(() => { result.current.setSelected(OTRO_MES) })
    expect(ids(result)).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('sin conexión el chip filtra lo de "Todas" ya cargado; sin "Todas" en caché se ve la carga', async () => {
    const { result } = lista()
    await waitFor(() => expect(result.current.contador).toBe(TODAS))
    onlineManager.setOnline(false)
    try {
      act(() => { result.current.setFilter('Entregada') })
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(ids(result)).toEqual(['b', 'c'])
      expect(result.current.contador).toBeNull()

      act(() => { result.current.setSelected(OTRO_MES) })
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(ids(result)).toEqual([])
      expect(result.current.isLoading).toBe(true)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
