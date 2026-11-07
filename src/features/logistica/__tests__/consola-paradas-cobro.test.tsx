import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
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
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
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


const EN_CURSO = 2
const ENTREGA = { id: 'p1', orden: 1, ventaId: 'v', direccion: 'Tarantino 1898', clienteNombre: 'Abel', montoTotal: 50, cantidadBultos: 1, latitud: 0, longitud: 0 }
const COBRO = { id: 'pc1', clienteId: 'c1', clienteNombre: 'Don Pepe', direccion: 'Av. Rivadavia 4500', orden: 2, estado: 1, montoAcordado: 85000, deudaCliente: 120000 }
const hoja = (o: Record<string, unknown>) => ({
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD', estado: EN_CURSO,
  fechaSalida: '2026-10-07T11:00:00Z', detalles: [], ...o,
})

function pintar(h: unknown) {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(h)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  useLogisticaStore.setState({ activeTrip: null })
  conTema('light')
})

describe('Consola del chofer: paradas de solo cobro (S9)', () => {
  it('una hoja con solo paradas de cobro las muestra y se puede finalizar aunque estén pendientes', async () => {
    pintar(hoja({ paradasCobro: [COBRO] }))
    expect(await screen.findByText('Solo cobro (1)')).toBeTruthy()
    expect(screen.getByLabelText('Cobrar en Av. Rivadavia 4500')).toBeTruthy()
    expect(await screen.findByLabelText('Finalizar viaje')).toBeTruthy()
  })

  it('con una entrega todavía sin reportar no se puede finalizar, aunque haya paradas de cobro', async () => {
    pintar(hoja({ detalles: [{ ...ENTREGA, estado: 1 }], paradasCobro: [COBRO] }))
    expect(await screen.findByText('Solo cobro (1)')).toBeTruthy()
    expect(screen.queryByLabelText('Finalizar viaje')).toBeNull()
  })

  it('sigue valiendo: una hoja vieja sin paradasCobro y sin entregas no muestra la sección ni se puede finalizar', async () => {
    pintar(hoja({}))
    expect(await screen.findByText('Viaje de hoy')).toBeTruthy()
    expect(screen.queryByText(/Solo cobro/)).toBeNull()
    expect(screen.queryByLabelText('Finalizar viaje')).toBeNull()
  })

  it('sigue valiendo: una hoja vieja con todas las entregas hechas se finaliza', async () => {
    pintar(hoja({ detalles: [{ ...ENTREGA, estado: 2 }] }))
    expect(await screen.findByLabelText('Finalizar viaje')).toBeTruthy()
    expect(screen.queryByText(/Solo cobro/)).toBeNull()
  })
})
