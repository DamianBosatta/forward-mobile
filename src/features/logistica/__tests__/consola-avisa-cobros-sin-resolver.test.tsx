import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
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
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))
jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), requestForegroundPermissionsAsync: jest.fn(), startLocationUpdatesAsync: jest.fn(), stopLocationUpdatesAsync: jest.fn(), hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false) }))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))

const EN_CURSO = 2
const cobro = (id: string, estado: number) => ({ id, clienteId: `c-${id}`, clienteNombre: `Cliente ${id}`, direccion: `Calle ${id}`, orden: 2, estado, montoAcordado: 1000, deudaCliente: 2000 })
const hoja = (paradasCobro: unknown[]) => ({
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD', estado: EN_CURSO,
  fechaSalida: '2026-10-07T11:00:00Z', detalles: [], paradasCobro,
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
})

describe.each(['light', 'dark'] as const)('Finalizar el viaje con cobros sin resolver (S26, %s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('avisa cuántas paradas de cobro quedan sin resolver, deja finalizar igual y dice que vuelven a pendientes', async () => {
    pintar(hoja([cobro('a', 1), cobro('b', 1), cobro('c', 2)]))
    fireEvent.press(await screen.findByLabelText('Finalizar viaje'))
    expect(await screen.findByText('Quedan 2 paradas de cobro sin resolver.')).toBeTruthy()
    expect(screen.getByText(/vuelven a quedar pendientes/)).toBeTruthy()
    expect(screen.getByLabelText('Finalizar igual')).toBeTruthy()
    expect(screen.getByLabelText('Cancelar')).toBeTruthy()
  })

  it('con una sola parada pendiente lo dice en singular', async () => {
    pintar(hoja([cobro('a', 1)]))
    fireEvent.press(await screen.findByLabelText('Finalizar viaje'))
    expect(await screen.findByText('Queda 1 parada de cobro sin resolver.')).toBeTruthy()
    expect(screen.getByText(/vuelve a quedar pendiente/)).toBeTruthy()
  })

  it('sin paradas de cobro sin resolver no avisa: el cierre sigue como antes', async () => {
    pintar(hoja([cobro('a', 2), cobro('b', 3)]))
    fireEvent.press(await screen.findByLabelText('Finalizar viaje'))
    expect(await screen.findByText('¿Finalizar el viaje?')).toBeTruthy()
    expect(screen.queryByText(/sin resolver/)).toBeNull()
    expect(screen.queryByLabelText('Finalizar igual')).toBeNull()
  })
})
