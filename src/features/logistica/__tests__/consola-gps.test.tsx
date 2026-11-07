import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as Location from 'expo-location'
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
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
}))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))

const loc = Location as jest.Mocked<typeof Location>
const permiso = (granted: boolean, canAskAgain = true) => ({ granted, canAskAgain, status: granted ? 'granted' : 'undetermined', expires: 'never' }) as never

const PROGRAMADA = 1
const EN_CURSO = 2
const HOJA = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: PROGRAMADA, fechaSalida: '2026-10-07T11:00:00Z',
  detalles: [{ id: 'p1', orden: 1, ventaId: 'v', direccion: 'Tarantino 1898', clienteNombre: 'Abel', montoTotal: 50, cantidadBultos: 1, latitud: 0, longitud: 0, estado: 2 }],
}
let hojaServidor: unknown = HOJA

function pintar(hoja: unknown = HOJA, usuarioId = 'u1') {
  hojaServidor = hoja
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: usuarioId, username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hojaServidor)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

/** El servidor, al iniciar, deja la hoja en curso (como hace `iniciar` de verdad). */
const iniciarResponde = () => mockPost.mockImplementation(async (url: string) => {
  if (url.endsWith('/iniciar')) hojaServidor = { ...HOJA, estado: EN_CURSO }
  return true
})

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  useLogisticaStore.setState({ activeTrip: null })
  loc.hasStartedLocationUpdatesAsync.mockResolvedValue(false)
  // Como el módulo real: una vez arrancada, la tarea figura arrancada.
  loc.startLocationUpdatesAsync.mockImplementation(async () => { loc.hasStartedLocationUpdatesAsync.mockResolvedValue(true) })
  loc.stopLocationUpdatesAsync.mockResolvedValue(undefined)
  conTema('light')
})

describe('Consola del chofer: GPS del viaje (S5)', () => {
  it('con permiso, Iniciar recorrido arranca el registro y la hoja sigue su curso', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    iniciarResponde()
    pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/iniciar', undefined)
    expect(loc.startLocationUpdatesAsync.mock.calls[0][1]).toEqual(expect.objectContaining({
      timeInterval: 60_000,
      accuracy: 3,
      foregroundService: expect.objectContaining({ notificationTitle: 'Forward está registrando el viaje' }),
    }))
    expect(await screen.findByLabelText('Finalizar viaje')).toBeTruthy()
    expect(screen.queryByLabelText('Activar ubicación')).toBeNull()
  })

  it('con el permiso negado en el sistema el viaje arranca igual y se avisa, sin pedir nada', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false, false))
    iniciarResponde()
    pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(await screen.findByText('Viaje sin ubicación.')).toBeTruthy()
    expect(await screen.findByLabelText('Finalizar viaje')).toBeTruthy()
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled()
  })

  it('sin decidir: primero explica y recién "Activar ubicación" dispara el pedido del sistema', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false))
    loc.requestForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    iniciarResponde()
    pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    const activar = await screen.findByLabelText('Activar ubicación')
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled()
    await userEvent.press(activar)
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1))
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
  })

  it('"Ahora no" no bloquea el viaje, no pide permiso y no vuelve a preguntar en ese viaje', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false))
    iniciarResponde()
    const primera = pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    await userEvent.press(await screen.findByLabelText('Ahora no'))
    await waitFor(() => expect(screen.queryByLabelText('Activar ubicación')).toBeNull())
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled()
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
    primera.unmount()
    pintar({ ...HOJA, estado: EN_CURSO })
    expect(await screen.findByText('1 de 1 entregadas')).toBeTruthy()
    expect(screen.queryByLabelText('Activar ubicación')).toBeNull()
  })

  it('si el servidor no deja iniciar, no arranca el GPS y se ve su mensaje', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    mockPost.mockRejectedValue(Object.assign(new Error('Falta la documentación de 2 paradas.'), { errors: [] }))
    pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(await screen.findByText('Falta la documentación de 2 paradas.')).toBeTruthy()
    expect(screen.getByLabelText('Iniciar recorrido')).toBeTruthy()
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it('si el módulo nativo falla al arrancar, el viaje arranca igual y se avisa', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    loc.startLocationUpdatesAsync.mockRejectedValue(new Error('Foreground service cannot be started'))
    iniciarResponde()
    pintar()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(await screen.findByText('Viaje sin ubicación.')).toBeTruthy()
    expect(await screen.findByLabelText('Finalizar viaje')).toBeTruthy()
  })

  it('abrir un viaje ya en curso retoma el registro (reinicio del teléfono o volver a entrar)', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    pintar({ ...HOJA, estado: EN_CURSO })
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1))
  })

  it('el viaje de otro chofer no registra nada', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    pintar({ ...HOJA, estado: EN_CURSO }, 'otro')
    expect(await screen.findByText('Esta hoja de ruta es de otro chofer: solo podés verla.')).toBeTruthy()
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
    expect(loc.getForegroundPermissionsAsync).not.toHaveBeenCalled()
  })

  it('Finalizar viaje frena el registro y sigue cerrando la pantalla como antes', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    mockPost.mockResolvedValue(true)
    pintar({ ...HOJA, estado: EN_CURSO })
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1))
    await userEvent.press(await screen.findByLabelText('Finalizar viaje'))
    const botones = await screen.findAllByLabelText('Finalizar viaje')
    await userEvent.press(botones[botones.length - 1])
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/finalizar', undefined))
    await waitFor(() => expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  })

  it('si el servidor no deja finalizar, el registro sigue', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
    mockPost.mockRejectedValue(Object.assign(new Error('Faltan paradas.'), { errors: [] }))
    pintar({ ...HOJA, estado: EN_CURSO })
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1))
    await userEvent.press(await screen.findByLabelText('Finalizar viaje'))
    const botones = await screen.findAllByLabelText('Finalizar viaje')
    await userEvent.press(botones[botones.length - 1])
    expect(await screen.findByText('Faltan paradas.')).toBeTruthy()
    expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })
})
