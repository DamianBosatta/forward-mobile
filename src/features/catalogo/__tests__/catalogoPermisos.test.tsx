import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoScreen from '../../../../app/(tabs)/inventario/index'
import StockScreen from '../../../../app/(tabs)/inventario/stock'
import { useAuthStore } from '@/features/auth/store/auth.store'

// S2 (#123): el catálogo lee de GET /api/v1/catalogo y se habilita con MOD_CATALOGO; Stock sigue pidiendo MOD_STOCK.

jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390 }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useLocalSearchParams: () => ({}), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const ITEM = {
  productoId: 'p-aer', nombre: 'Saphirus Aerosol 250 ml', codigoPropio: 'SAP-AER-250', marca: 'Saphirus', categoria: 'Aerosoles',
  linea: 'Hogar', familia: 'Aerosoles', tipo: '', subtipo: '', imageUrl: null, precioVenta: 3077.85, disponible: true, precioConOferta: null, fragancias: [],
}
const PAGINA = { items: [ITEM], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNextPage: false }

function conPermisos(modulos: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: modulos.map((module) => ({ module, canRead: true })) as never },
  })
}

function renderEn(pantalla: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(<QueryClientProvider client={client}>{pantalla}</QueryClientProvider>)
}

const llamadasGet = () => api.get.mock.calls.map(([url]) => url as string)

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) =>
    url.startsWith('/api/v1/catalogo?') ? Promise.resolve(PAGINA) : Promise.reject(new Error(`sin respuesta para ${url}`)),
  )
  api.post.mockReset().mockResolvedValue([])
})

describe('Catálogo con MOD_CATALOGO (S2)', () => {
  it('un vendedor con MOD_CATALOGO y sin Stock ve el catálogo, leído de /api/v1/catalogo', async () => {
    conPermisos(['MOD_CATALOGO'])
    renderEn(<CatalogoScreen />)

    expect(await screen.findByText(ITEM.nombre)).toBeTruthy()
    expect(screen.queryByText(/No tenés acceso/)).toBeNull()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/catalogo?'))).toBe(true)
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Productos?'))).toBe(false)
  })

  it('sin MOD_CATALOGO no hay catálogo, aunque tenga Stock, y no se pide nada', () => {
    conPermisos(['MOD_STOCK'])
    renderEn(<CatalogoScreen />)

    expect(screen.getByText(/No tenés acceso/)).toBeTruthy()
    expect(screen.queryByText(ITEM.nombre)).toBeNull()
    expect(api.get).not.toHaveBeenCalled()
  })
})

describe('Stock sigue separado (S2)', () => {
  it('la pantalla Stock sigue pidiendo MOD_STOCK: con solo MOD_CATALOGO no entra', () => {
    conPermisos(['MOD_CATALOGO'])
    renderEn(<StockScreen />)

    expect(screen.getByText(/No tenés acceso/)).toBeTruthy()
  })
})
