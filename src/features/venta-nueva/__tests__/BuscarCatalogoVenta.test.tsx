import React from 'react'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CatalogoVenta } from '../components/CatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { DEBOUNCE_BUSQUEDA_MS } from '../hooks/useCatalogoVenta'
import { producto } from '../__testing__/producto'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a) },
}))

const pala = producto()
const linea = producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true })
const familia = [linea, producto({ id: 'pv1', nombre: 'Saphirus Aerosol - Lavanda', productoPadreId: 'pf' }), producto({ id: 'pv2', nombre: 'Saphirus Aerosol - Coco', productoPadreId: 'pf' })]
const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 1000, totalCount: items.length, totalPages: 1, hasNextPage: false })
const pidioBusqueda = () => mockGet.mock.calls.some(([u]) => String(u).includes('SearchTerm='))

beforeEach(() => {
  jest.useFakeTimers()
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [] } as never })
  useCarritoVenta.setState({ lineas: [] })
})
afterEach(() => jest.useRealTimers())

async function buscar(texto: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CatalogoVenta onVerVenta={jest.fn()} /></QueryClientProvider>)
  await act(async () => {})
  await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).type(screen.getByLabelText('Producto, marca o código'), texto)
  await act(async () => jest.advanceTimersByTime(DEBOUNCE_BUSQUEDA_MS))
  await act(async () => {})
}

// El bug: "lavanda" solo coincide con una fragancia, que el catálogo no muestra suelta; la línea no
// coincidía y quedaba "No hay productos que coincidan".
describe('buscar en el catálogo de venta', () => {
  it('con el catálogo cargado, «lavanda» encuentra la línea sin ir al servidor', async () => {
    mockGet.mockReset().mockResolvedValue(pagina([pala, ...familia]))
    await buscar('lavanda')

    expect(await screen.findByText('Mostrando 1 de 2')).toBeTruthy()
    expect(screen.getByTestId('producto-pf')).toBeTruthy()
    expect(screen.queryByTestId('producto-p1')).toBeNull()
    expect(pidioBusqueda()).toBe(false)
  })
})
