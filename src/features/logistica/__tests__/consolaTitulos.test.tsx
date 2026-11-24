import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { storage } from '@/core/utils/storage'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
const mockReplace = jest.fn()
const mockParams = jest.fn((): Record<string, string> => ({}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams(),
}))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))
jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), requestForegroundPermissionsAsync: jest.fn(), startLocationUpdatesAsync: jest.fn(), stopLocationUpdatesAsync: jest.fn(), hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(true) }))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))



const hoja = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD', estado: 2,
  fechaSalida: '2026-10-07T11:00:00Z',
  detalles: [{ id: 'p1', orden: 1, ventaId: 'v', direccion: 'Tarantino 1898', clienteNombre: 'Abel', montoTotal: 50, cantidadBultos: 1, latitud: 0, longitud: 0, estado: 1 }],
}

function pintar(lista: unknown[]) {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hoja)
      : url.includes('hojas-ruta?') ? Promise.resolve(lista)
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  useLogisticaStore.getState().reset()
  mockParams.mockReturnValue({})
})

describe.each(['light', 'dark'] as const)('Consola del chofer: títulos y vacío (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('MD-11: opened from the Hojas list (with an id) the bar says "Hoja de ruta", like the list', async () => {
    mockParams.mockReturnValue({ id: 'h1' })
    pintar([])
    expect(await screen.findByText('Hoja de ruta')).toBeTruthy()
    expect(screen.queryByText('Viaje de hoy')).toBeNull()
  })

  it('without an id it keeps "Viaje de hoy"', async () => {
    pintar([{ id: 'h1' }])
    expect(await screen.findByText('Viaje de hoy')).toBeTruthy()
  })
})
