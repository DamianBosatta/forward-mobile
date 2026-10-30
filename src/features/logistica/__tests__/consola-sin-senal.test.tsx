import React from 'react'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { reiniciarCamara } from '@/features/logistica/__testing__/camara'
import { leerCola, quitarDeCola } from '../cola'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

/**
 * Consola del chofer sin señal (chofer-01-viaje--sin-senal, chofer-07-estados): lo que se reporta sin conexión queda
 * en el teléfono con la misma clave de idempotencia, la parada pasa a hechas y la píldora cuenta lo que espera.
 */

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
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))
jest.mock('expo-camera', () => require('@/features/logistica/__testing__/camara').expoCameraSimulada)

const parada = (o: { id: string } & Record<string, unknown>) => ({
  ventaId: 'v', telefono: '', cantidadBultos: 1, latitud: 0, longitud: 0, estado: 1, montoTotal: 1000, ...o,
})
const HOJA = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z', rutaCalculada: true, distanciaTotalMetros: 0, exigeFotoRemitoAlEntregar: false,
  detalles: [
    parada({ id: 'p1', ventaId: 'v1', orden: 1, direccion: 'Tarantino 1898', clienteNombre: 'Abel' }),
    parada({ id: 'p2', ventaId: 'v2', orden: 2, direccion: 'Av. del Valle 89', clienteNombre: 'Chela' }),
  ],
}
const MEDIOS = [{ id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' }]
const RENGLONES = [
  { ventaDetalleId: 'd1', productoId: 'pr1', productoNombre: 'Aceite 900 ml', cantidadVendida: 6, cantidadDevuelta: 0, cantidadDisponible: 6, precioUnitario: 100 },
]

/** El viaje se baja con señal (sin ella la consulta queda en pausa) y recién después se corta: así llega el chofer a un túnel. */
async function pintar(hoja: Record<string, unknown> = HOJA, cortarSenal = true) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'C', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true, canUpdate: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hoja)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : url.endsWith('/medios-cobro') ? Promise.resolve(MEDIOS)
      : url.endsWith('/hojas-ruta/h1/paradas/p1/lineas') ? Promise.resolve(RENGLONES)
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  act(() => onlineManager.setOnline(true))
  const vista = render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
  await screen.findByLabelText('¡Llegué!')
  if (cortarSenal) act(() => onlineManager.setOnline(false))
  return vista
}

const ENTREGAR = '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'
const llamadasA = (url: string) => mockPost.mock.calls.filter(([u]) => u === url)

async function abrirEntrega(devuelve = false) {
  await userEvent.press(await screen.findByLabelText('¡Llegué!'))
  await userEvent.press(await screen.findByLabelText('Entregué todo'))
  if (!devuelve) await userEvent.press(screen.getByLabelText('No, todo bien'))
}
const continuar = () => userEvent.press(screen.getByLabelText('Continuar'))
/** Sin cobro: del cobro al paso Confirmar (quién recibió escrito), donde está "Confirmar entrega". */
async function alResumen(receptor = 'Abel') {
  await continuar()
  await userEvent.type(screen.getByLabelText('Quién recibió'), receptor)
}
async function cerrarListo() {
  await screen.findByLabelText('Entrega lista')
  await userEvent.press(screen.getByLabelText('Siguiente entrega'))
}

beforeEach(() => {
  jest.clearAllMocks()
  useLogisticaStore.setState({ activeTrip: null })
  conTema('light')
  reiniciarCamara()
  for (const a of leerCola('u1')) quitarDeCola('u1', a.clave)
})
afterEach(() => {
  act(() => onlineManager.setOnline(true))
})

describe('Consola del chofer sin señal', () => {
  it('avisa que se puede seguir trabajando y que se manda solo cuando vuelva', async () => {
    await pintar()
    expect(await screen.findByText(/Seguí trabajando: se manda solo cuando vuelva/)).toBeTruthy()
    expect(screen.queryByText(/necesitás conexión/)).toBeNull()
  })

  it('una entrega sin señal no llama al servidor: queda guardada con su clave y su cuerpo, y lo dice', async () => {
    await pintar()
    await abrirEntrega()
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await screen.findByLabelText('Entrega lista')
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByText('Entrega guardada en el teléfono. Se manda sola cuando haya señal.')).toBeTruthy()
    const cola = leerCola('u1')
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({
      tipo: 'entrega', hojaDeRutaId: 'h1', paradaId: 'p1', clienteNombre: 'Abel', estado: { tipo: 'esperando', intentos: 0 },
      cuerpo: { claveIdempotencia: cola[0].clave, nombreReceptor: 'Abel' },
    })
  })

  it('al volver al viaje la parada ya está hecha, el progreso avanza y la píldora cuenta la acción con "Ver"', async () => {
    await pintar()
    await abrirEntrega()
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await cerrarListo()
    expect(await screen.findByText('1 de 2 entregadas')).toBeTruthy()
    expect(screen.getByLabelText('1 acción esperando señal')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Ver las acciones esperando señal'))
    const hoja = await screen.findByLabelText('Acciones esperando señal')
    expect(within(hoja).getByText('Entrega')).toBeTruthy()
    expect(within(hoja).getByText('Abel')).toBeTruthy()
  })

  it('la lista dice qué se hizo: entrega, cobro y devolución, con lo cobrado', async () => {
    // Renglones y medios de cobro se bajan con señal; la señal se corta antes de confirmar.
    await pintar(HOJA, false)
    await abrirEntrega(true)
    await userEvent.press(screen.getByLabelText('Sí, devuelve algo'))
    await userEvent.press(await screen.findByLabelText('Sumar una de Aceite 900 ml'))
    await continuar()
    await userEvent.press(await screen.findByLabelText('Efectivo'))
    act(() => onlineManager.setOnline(false))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '500')
    await continuar()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await cerrarListo()
    await userEvent.press(await screen.findByLabelText('Ver las acciones esperando señal'))
    const hoja = await screen.findByLabelText('Acciones esperando señal')
    expect(within(hoja).getByText('Entrega, cobro y devolución')).toBeTruthy()
    expect(within(hoja).getByText(/Abel · cobrado/)).toBeTruthy()
  })

  it('"No pude entregar" sin señal se guarda para reportar-parada, avisa que quedó guardado y la parada pasa a hechas', async () => {
    await pintar()
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(await screen.findByText(/Guardado sin señal/)).toBeTruthy()
    expect(leerCola('u1')).toEqual([
      expect.objectContaining({ tipo: 'noEntrega', paradaId: 'p1', cuerpo: expect.objectContaining({ entregado: false, motivoRechazo: 'Cerrado o sin nadie' }) }),
    ])
    expect(await screen.findByLabelText('1 acción esperando señal')).toBeTruthy()
    expect(screen.queryByLabelText('¡Llegué!')).toBeTruthy() // la próxima parada pasa a ser la de Chela
    expect(screen.getByText('Chela')).toBeTruthy()
  })

  it('con señal sigue llamando al servidor y no guarda nada', async () => {
    mockPost.mockResolvedValue({ paradaId: 'p1', repetida: false })
    await pintar(HOJA, false)
    await abrirEntrega()
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await cerrarListo()
    expect(llamadasA(ENTREGAR)).toHaveLength(1)
    expect(leerCola('u1')).toEqual([])
    expect(screen.queryByLabelText(/esperando señal/)).toBeNull()
  })

  it('si el pedido no llega aunque el teléfono crea tener señal, la entrega también queda guardada', async () => {
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
    await pintar(HOJA, false)
    await abrirEntrega()
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await screen.findByLabelText('Entrega lista')
    expect(leerCola('u1')).toHaveLength(1)
    expect(screen.getByText('Entrega guardada en el teléfono. Se manda sola cuando haya señal.')).toBeTruthy()
  })

  it('no se puede finalizar el viaje mientras queden acciones sin mandar', async () => {
    await pintar({ ...HOJA, detalles: [HOJA.detalles[0]] })
    await abrirEntrega()
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await screen.findByLabelText('Entrega lista')
    await userEvent.press(screen.getByLabelText('Terminé el viaje'))
    expect(screen.queryByText('¿Finalizar el viaje?')).toBeNull()
    expect(screen.getByText('Falta mandar 1 acción: esperá la señal para finalizar.')).toBeTruthy()
  })
})
