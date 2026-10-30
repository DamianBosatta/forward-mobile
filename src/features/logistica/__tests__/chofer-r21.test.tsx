import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { permisoCamara, reiniciarCamara, sacarFoto, tomarFoto } from '@/features/logistica/__testing__/camara'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

/**
 * R21 (bloque 13, parcial de T12a): "No cobré" con motivo (C2, ChoferEntrega), cámara propia (C3,
 * ChoferCamara) y foto del lugar al no entregar (C5, ChoferNoEntrega).
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
const mockGaleria = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockGaleria(),
  launchCameraAsync: () => mockGaleria(),
  launchImageLibraryAsync: () => mockGaleria(),
}))

const parada = (o: { id: string } & Record<string, unknown>) => ({
  ventaId: 'v', telefono: '', cantidadBultos: 1, latitud: 0, longitud: 0, estado: 1, montoTotal: 1000, ...o,
})
const P1 = parada({ id: 'p1', ventaId: 'v1', orden: 1, direccion: 'Tarantino 1898', clienteNombre: 'Abel', numeroNotaEntrega: 16918 })
const P1_CONTADO = { ...P1, tipoCobro: 'Contado', montoCobrar: 1000 }
const hoja = (p1: Record<string, unknown>) => ({
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z', rutaCalculada: true, distanciaTotalMetros: 0, exigeFotoRemitoAlEntregar: false,
  detalles: [p1, parada({ id: 'p2', ventaId: 'v2', orden: 2, direccion: 'Av. del Valle 89', clienteNombre: 'Chela' })],
})
const MEDIOS = [{ id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' }]

function pintar(h: Record<string, unknown>) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'C', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true, canUpdate: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(h)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : url.endsWith('/medios-cobro') ? Promise.resolve(MEDIOS)
      : url.endsWith('/hojas-ruta/h1/paradas/p1/lineas') ? Promise.resolve([])
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

const ENTREGAR = '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'
const REPORTAR = '/api/v1/Logistica/hojas-ruta/h1/reportar-parada'
const llamadasA = (url: string) => mockPost.mock.calls.filter(([u]) => u === url)
const abrir = async () => {
  await userEvent.press(await screen.findByLabelText('¡Llegué!'))
  await userEvent.press(await screen.findByLabelText('Entregué todo'))
}
const continuar = () => screen.getByLabelText('Continuar')
const deshabilitado = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true
async function hastaElCobro() {
  await userEvent.press(screen.getByLabelText('No, todo bien'))
}
async function confirmarDesdeElCobro(observaciones?: string) {
  await userEvent.press(continuar())
  await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
  if (observaciones) await userEvent.type(screen.getByLabelText('Observaciones'), observaciones)
  await userEvent.press(screen.getByLabelText('Confirmar entrega'))
  await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
  return llamadasA(ENTREGAR)[0][1] as Record<string, unknown>
}

beforeEach(() => {
  jest.clearAllMocks()
  useLogisticaStore.setState({ activeTrip: null })
  conTema('light')
  reiniciarCamara()
  let subidas = 0
  mockPost.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Media/upload-entrega') return { url: `https://r2.test/entregas/up-${++subidas}.jpg` }
    return { paradaId: 'p1' }
  })
})

describe('C2 No cobré con motivo', () => {
  it('con algo para cobrar ofrece Cobré / No cobré y la lista fija de motivos', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    for (const m of ['No estaba', 'No tenía plata', 'Paga en el local', 'Otro']) expect(screen.getByLabelText(m)).toBeTruthy()
    expect(screen.queryByLabelText('Efectivo')).toBeNull()
  })

  it('sin elegir el motivo no sigue y lo dice', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Elegí por qué no cobraste')).toBeTruthy()
  })

  it('el motivo viaja dentro de las observaciones de la entrega, sin cobro', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    await userEvent.press(screen.getByLabelText('No estaba'))
    const cuerpo = await confirmarDesdeElCobro()
    expect(cuerpo.observaciones).toBe('No cobré: No estaba')
    expect(cuerpo.cobro).toBeUndefined()
  })

  it('va adelante de lo que escribió el chofer', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    await userEvent.press(screen.getByLabelText('Paga en el local'))
    const cuerpo = await confirmarDesdeElCobro('Dejé el pedido en la puerta')
    expect(cuerpo.observaciones).toBe('No cobré: Paga en el local · Dejé el pedido en la puerta')
  })

  it('"Otro" exige un texto corto y manda ese texto', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    await userEvent.press(screen.getByLabelText('Otro'))
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Escribí por qué no cobraste')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Por qué no cobraste'), 'Cobra el viajante')
    const cuerpo = await confirmarDesdeElCobro()
    expect(cuerpo.observaciones).toBe('No cobré: Cobra el viajante')
  })

  it('un cobro quitado no viaja si después eligió Cuenta corriente', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '500')
    await userEvent.press(screen.getByLabelText('Quitar cobro 1'))
    await userEvent.press(screen.getByLabelText('Cuenta corriente'))
    await userEvent.press(screen.getByLabelText('No tenía plata'))
    const cuerpo = await confirmarDesdeElCobro()
    expect(cuerpo.cobro).toBeUndefined()
    expect(cuerpo.observaciones).toBe('No cobré: No tenía plata')
  })

  it('antes: sin nada para cobrar no aparece la opción y la entrega va igual que siempre', async () => {
    pintar(hoja({ ...P1, tipoCobro: 'CuentaCorriente' }))
    await abrir()
    await hastaElCobro()
    expect(screen.queryByLabelText('Cuenta corriente')).toBeNull()
    const cuerpo = await confirmarDesdeElCobro('Todo ok')
    expect(cuerpo.observaciones).toBe('Todo ok')
  })
})

describe('C3 Cámara propia', () => {
  it('la foto se saca con la cámara de la app, con su encuadre, nunca con el selector del sistema', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Sacar foto del remito firmado'))
    const camara = within(await screen.findByLabelText('Cámara'))
    expect(camara.getByText('Foto del remito')).toBeTruthy()
    expect(camara.getByText('Remito NTE16918 · Tarantino 1898')).toBeTruthy()
    expect(camara.getByText('Encuadrá el remito entero, con la firma y la aclaración a la vista')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Sacar la foto'))
    expect(await screen.findByText('Foto del remito firmado cargada')).toBeTruthy()
    expect(tomarFoto).toHaveBeenCalledTimes(1)
    expect(mockGaleria).not.toHaveBeenCalled()
    expect(llamadasA('/api/v1/Media/upload-entrega')).toHaveLength(1)
  })

  it('cancelar cierra la cámara sin foto ni subida', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Sacar foto del remito firmado'))
    await userEvent.press(await screen.findByLabelText('Cancelar la foto'))
    expect(screen.queryByLabelText('Sacar la foto')).toBeNull()
    expect(tomarFoto).not.toHaveBeenCalled()
    expect(llamadasA('/api/v1/Media/upload-entrega')).toHaveLength(0)
  })

  it('sin permiso explica cómo darlo y no dispara', async () => {
    permisoCamara.actual = { granted: false, canAskAgain: true }
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Sacar foto del remito firmado'))
    expect(await screen.findByText('Falta el permiso de la cámara')).toBeTruthy()
    expect(screen.getByLabelText('Permitir la cámara')).toBeTruthy()
    expect(screen.queryByLabelText('Sacar la foto')).toBeNull()
  })
})

describe('C5 Foto del lugar al no entregar', () => {
  it('es opcional y viaja en evidenciaUrl del reporte', async () => {
    pintar(hoja(P1))
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    expect(screen.getByText('Opcional')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await sacarFoto('Sacar foto del lugar')
    await screen.findByText('Foto del lugar cargada')
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    await waitFor(() => expect(llamadasA(REPORTAR)).toHaveLength(1))
    expect(llamadasA(REPORTAR)[0][1]).toEqual({
      hojaDeRutaId: 'h1', paradaId: 'p1', entregado: false, motivoRechazo: 'Cerrado o sin nadie', observaciones: undefined,
      evidenciaUrl: 'https://r2.test/entregas/up-1.jpg',
    })
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })

  it('antes: sin foto el reporte va sin evidenciaUrl', async () => {
    pintar(hoja(P1))
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    await userEvent.press(screen.getByLabelText('Dirección incorrecta'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    await waitFor(() => expect(llamadasA(REPORTAR)).toHaveLength(1))
    expect((llamadasA(REPORTAR)[0][1] as Record<string, unknown>).evidenciaUrl).toBeUndefined()
  })
})
