import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CatalogoVenta } from '../components/CatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
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

beforeEach(() => {
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [] } as never })
  useCarritoVenta.setState({ lineas: [] })
})

// El bug: "lavanda" solo coincide con una fragancia, que el catálogo no muestra suelta; la línea no
// coincidía y quedaba "No hay productos que coincidan".
describe.each([
  ['servidor que busca (devuelve la familia)', familia],
  ['servidor viejo (ignora SearchTerm y devuelve todo)', [pala, ...familia]],
])('buscar en el catálogo de venta: %s', (_, respuesta) => {
  it('"lavanda" encuentra la línea de esa fragancia', async () => {
    mockGet.mockReset().mockImplementation(async (url: string) => pagina(url.includes('SearchTerm=') ? respuesta : [pala, ...familia]))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><CatalogoVenta onVerVenta={jest.fn()} /></QueryClientProvider>)
    await screen.findByTestId('producto-p1')
    await userEvent.type(screen.getByLabelText('Buscar por código o nombre'), 'lavanda')

    expect(await screen.findByText('1 resultados')).toBeTruthy()
    expect(screen.getByTestId('producto-pf')).toBeTruthy()
    expect(screen.queryByTestId('producto-p1')).toBeNull()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Productos/catalogo-stock?SearchTerm=lavanda&PageSize=1000')
  })
})
