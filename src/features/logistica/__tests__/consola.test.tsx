import React from 'react'
import { Linking, Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { themeColors } from '@/libs/theme'
import { conTema, estilo } from '@/core/ui/fw/__testing__/tema'
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
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))

const parada = (o: { id: string } & Record<string, unknown>) => ({
  ventaId: 'v', telefono: '11 4567-8900', cantidadBultos: 2, latitud: 0, longitud: 0, estado: 1, ...o,
})

const HOJA = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z',
  detalles: [
    parada({ id: 'p6', orden: 6, direccion: 'Luis Balcarce 312', clienteNombre: 'Almacén Luis', montoTotal: 1000 }),
    parada({ id: 'p4', orden: 4, direccion: 'Juan B. Justo 6376', clienteNombre: 'Carlos', montoTotal: 214560, cantidadBultos: 3 }),
    parada({ id: 'p2', orden: 2, direccion: 'Tarantino 1898', clienteNombre: 'Autoservicio Abel', montoTotal: 50, estado: 2 }),
    parada({ id: 'p5', orden: 5, direccion: 'Av. del Valle 89', clienteNombre: 'Chela', montoTotal: 59566.01 }),
  ],
}

let hojaServidor: unknown = HOJA

function pintar(hoja: unknown = HOJA, choferId = 'u1') {
  hojaServidor = hoja
  useAuthStore.setState({
    user: { id: choferId, username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hojaServidor)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  useLogisticaStore.setState({ activeTrip: null })
  conTema('light')
})

describe('Consola del chofer: hoja de ruta', () => {
  it('la próxima parada es la pendiente de menor orden, con la dirección como título y el nombre aparte', async () => {
    pintar()
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(within(proxima).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(proxima).getByText('Carlos')).toBeTruthy()
    expect(within(proxima).getByText('Parada 2 · 3 bultos')).toBeTruthy()
    // El importe es el total que manda el servidor, sin inventar el tipo de cobro.
    expect(within(proxima).getByText('$ 214.560,00')).toBeTruthy()
    expect(screen.getByText('1 de 4 paradas')).toBeTruthy()
    expect(screen.getByLabelText('Parada 3: Av. del Valle 89')).toBeTruthy()
    expect(screen.getByLabelText('Parada 4: Luis Balcarce 312')).toBeTruthy()
    expect(within(screen.getByLabelText('Parada 1: Tarantino 1898')).getByLabelText('Estado: Entregado')).toBeTruthy()
  })

  it('Cómo llegar abre el mapa con la dirección y Llamar marca el teléfono', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    pintar()
    await userEvent.press(await screen.findByLabelText('Cómo llegar'))
    const mapa = String(abrir.mock.calls[0][0])
    expect(mapa).toContain(encodeURIComponent('Juan B. Justo 6376'))
    expect(mapa).toMatch(Platform.OS === 'ios' ? /^maps:/ : /google\.com\/maps\/dir/)
    await userEvent.press(screen.getByLabelText('Llamar'))
    expect(abrir).toHaveBeenLastCalledWith('tel:1145678900')
  })

  it('entregado: no confirma sin quién recibió y manda el resultado con el comando actual', async () => {
    // El servidor, después del reporte, devuelve la parada entregada.
    mockPost.mockImplementation(async () => {
      hojaServidor = { ...HOJA, detalles: HOJA.detalles.map((d) => (d.id === 'p4' ? { ...d, estado: 2 } : d)) }
      return true
    })
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    const confirmar = screen.getByLabelText('Confirmar entrega')
    expect(confirmar.props.accessibilityState.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Carlos')
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/reportar-parada', {
      hojaDeRutaId: 'h1', paradaId: 'p4', entregado: true, nombreReceptor: 'Carlos', observaciones: undefined,
    })
    expect(await screen.findByText('2 de 4 paradas')).toBeTruthy()
    expect(screen.queryByLabelText('Confirmar entrega')).toBeNull()
  })

  it('no se pudo entregar: pide el motivo y lo manda como motivoRechazo', async () => {
    mockPost.mockResolvedValue(true)
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    await userEvent.press(screen.getByLabelText('No se pudo entregar'))
    expect(screen.getByLabelText('Confirmar: no se entregó').props.accessibilityState.disabled).toBe(true)
    await userEvent.press(screen.getByLabelText('Dirección incorrecta'))
    await userEvent.press(screen.getByLabelText('Confirmar: no se entregó'))
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('reportar-parada'), expect.objectContaining({
      paradaId: 'p4', entregado: false, motivoRechazo: 'Dirección incorrecta',
    }))
  })

  it('si el servidor rechaza, el motivo queda a la vista y el reporte sigue abierto', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('La venta ya no está en ruta.'), { errors: [] }))
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Carlos')
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    expect(await screen.findByText('La venta ya no está en ruta.')).toBeTruthy()
    expect(screen.getByLabelText('Confirmar entrega')).toBeTruthy()
    expect(screen.getByText('1 de 4 paradas')).toBeTruthy()
  })

  it('antes de iniciar no se reporta; la hoja de otro chofer es solo lectura', async () => {
    pintar({ ...HOJA, estado: 1 })
    expect(await screen.findByLabelText('Iniciar recorrido')).toBeTruthy()
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
    screen.unmount()
    useLogisticaStore.setState({ activeTrip: null })
    pintar(HOJA, 'otro')
    expect(await screen.findByText(/es de otro chofer/)).toBeTruthy()
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
  })

  it('en oscuro la tarjeta de la próxima parada usa la marca del tema oscuro', async () => {
    conTema('dark')
    pintar()
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(estilo(proxima).borderColor).toBe(themeColors.dark.brand)
    expect(estilo(proxima).backgroundColor).toBe(themeColors.dark.surface)
  })
})
