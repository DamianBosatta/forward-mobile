import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { reiniciarCamara, sacarFoto } from '@/features/logistica/__testing__/camara'
import { REMITO_URL, conSubidaDeFotos, confirmarEntrega, fotoDelRemito, noSumarOtroCobro } from '@/features/logistica/__testing__/confirmar'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

/**
 * Cierre del bloque 9 (BACKLOG-9B, "foto del remito y cobro en la entrega" y "hoja editada en la
 * oficina"): la entrega va por la operación única `entregar` (forward-system #956) con la foto por
 * `upload-entrega` (#953); "no se pudo entregar" sigue por `reportar-parada`.
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
jest.mock('expo-router/react-navigation', () => ({
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
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' },
  { id: 'm-tr', nombre: 'Transferencia', tipo: 'Transferencia' },
  { id: 'm-ch', nombre: 'Cheque', tipo: 'Cheque' },
]
const RENGLONES = [
  { ventaDetalleId: 'd1', productoId: 'pr1', productoNombre: 'Aceite 900 ml', cantidadVendida: 6, cantidadDevuelta: 0, cantidadDisponible: 6, precioUnitario: 100 },
]

let hojaServidor: Record<string, unknown> = HOJA
const entregada = () => {
  hojaServidor = { ...HOJA, detalles: HOJA.detalles.map((d) => (d.id === 'p1' ? { ...d, estado: 2 } : d)) }
}

function pintar(hoja: Record<string, unknown> = HOJA, permissions: unknown[] = [{ module: 'MOD_VIAJES', canRead: true, canUpdate: true }]) {
  hojaServidor = hoja
  useAuthStore.setState({ user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'C', roles: [], permissions } } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hojaServidor)
      : url.includes('hojas-ruta?') ? Promise.resolve([{ id: 'h1' }])
      : url.endsWith('/medios-cobro') ? Promise.resolve(MEDIOS)
      : url.endsWith('/hojas-ruta/h1/paradas/p1/lineas') ? Promise.resolve(RENGLONES)
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

const ENTREGAR = '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'
const llamadasA = (url: string) => mockPost.mock.calls.filter(([u]) => u === url)

// La entrega va en pasos: llegué, devoluciones, cobro y confirmar. Por defecto "No, todo bien" (cae en el cobro).
async function abrirEntrega(devuelve = false) {
  await userEvent.press(await screen.findByLabelText('¡Llegué!'))
  await userEvent.press(await screen.findByLabelText('Entregué todo'))
  if (!devuelve) await userEvent.press(screen.getByLabelText('No'))
}
const continuar = () => userEvent.press(screen.getByLabelText('Continuar'))
/**
 * Del cobro al paso Confirmar (quién recibió escrito), donde está "Confirmar entrega". Sin cobro de dinero el remito
 * firmado con su foto es obligatorio (dueño 08-11): la helper lo saca, salvo `sinFoto`. Con cobro, "¿Sumar otro cobro?" → No.
 */
async function alResumen(receptor = 'Abel', { conCobro = false, sinFoto = false } = {}) {
  if (!conCobro && !sinFoto) conSubidaDeFotos(mockPost)
  await continuar()
  if (conCobro) await noSumarOtroCobro()
  else if (!sinFoto) await fotoDelRemito()
  await userEvent.type(screen.getByLabelText('Quién recibió'), receptor)
}
/** La pantalla "Entrega lista" aparece al registrar la entrega; "Siguiente entrega" la cierra. */
async function cerrarListo() {
  await screen.findByLabelText('Entrega lista')
  await userEvent.press(screen.getByLabelText('Siguiente entrega'))
}

beforeEach(() => {
  jest.clearAllMocks()
  useLogisticaStore.setState({ activeTrip: null })
  conTema('light')
  reiniciarCamara()
})

describe('Consola del chofer: entrega con la operación única', () => {
  it('entregado manda entregar con la clave, quién recibió y nada de cobro; la parada pasa a hechas', async () => {
    mockPost.mockImplementation(async () => { entregada(); return { paradaId: 'p1', repetida: false } })
    pintar()
    await abrirEntrega()
    await alResumen()
    await confirmarEntrega()
    const [[url, cuerpo]] = llamadasA(ENTREGAR)
    expect(url).toBe(ENTREGAR)
    expect(cuerpo).toEqual({ claveIdempotencia: expect.stringMatching(/\S{8,}/), nombreReceptor: 'Abel', evidenciaUrl: REMITO_URL })
    await cerrarListo()
    expect(await screen.findByText('1 de 2 entregadas')).toBeTruthy()
    expect(llamadasA('/api/v1/Logistica/hojas-ruta/h1/reportar-parada')).toHaveLength(0)
  })

  it('quién recibió es opcional (decisión del dueño del 05-11): sin nombre se confirma y no viaja nombreReceptor', async () => {
    pintar({ ...HOJA, exigeFotoRemitoAlEntregar: false })
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('Entregué todo'))
    await userEvent.press(screen.getByLabelText('No'))
    await alResumen('   ')
    expect(screen.getByLabelText('Cerrar entrega').props.accessibilityState.disabled).toBeFalsy()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1].nombreReceptor).toBeUndefined()
  })

  it('con la foto del remito exigida no confirma sin ella; la foto se sube por upload-entrega y viaja como evidencia', async () => {
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/api/v1/Media/upload-entrega') return { url: 'https://r2.test/entregas/remito.jpg' }
      entregada()
      return { paradaId: 'p1' }
    })
    pintar({ ...HOJA, exigeFotoRemitoAlEntregar: true })
    await abrirEntrega()
    await alResumen('Abel', { sinFoto: true })
    // El paso Confirmar no deja confirmar sin la foto exigida.
    expect(screen.getByLabelText('Cerrar entrega').props.accessibilityState.disabled).toBe(true)
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
    // El pie dice qué falta y "Firmar" avisa que sin la foto del remito firmado no se cierra (S8).
    expect(screen.getByText('Falta la foto del remito')).toBeTruthy()
    expect(screen.getByText('Abre la cámara: foto del remito firmado')).toBeTruthy()
    expect(screen.getByText('Sin la foto del remito firmado no se cierra la entrega.')).toBeTruthy()

    await sacarFoto('Firmar')
    expect(await screen.findByText('Remito firmado')).toBeTruthy()
    // Con la foto: miniatura y la fila verde que se toca para volver a sacarla.
    expect(screen.getByLabelText('Miniatura del remito firmado')).toBeTruthy()
    expect(screen.getByLabelText('Volver a sacar la foto del remito firmado')).toBeTruthy()
    expect(screen.queryByText('Falta la foto del remito')).toBeNull()
    expect(screen.queryByText('Sin la foto del remito firmado no se cierra la entrega.')).toBeNull()
    const [[, form]] = llamadasA('/api/v1/Media/upload-entrega')
    expect(form).toBeInstanceOf(FormData)

    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1]).toMatchObject({ nombreReceptor: 'Abel', evidenciaUrl: 'https://r2.test/entregas/remito.jpg' })
  })

  it('cobro mixto: efectivo y transferencia con la foto del comprobante, al pedido de hoy, con la firma opcional del remito', async () => {
    let foto = 0
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/api/v1/Media/upload-entrega') return { url: `https://r2.test/entregas/${++foto}.jpg` }
      entregada()
      return { paradaId: 'p1' }
    })
    pintar()
    await abrirEntrega()
    await userEvent.press(screen.getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '600')
    await continuar()
    await userEvent.press(await screen.findByLabelText('Sí'))
    await userEvent.press(screen.getByLabelText('Transferencia'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 2'), '400,50')

    // Sin la foto del comprobante la transferencia no sale: el paso no deja seguir y lo dice.
    expect(screen.getByLabelText('Continuar').props.accessibilityState.disabled).toBe(true)
    expect(await screen.findByText(/Falta la foto del comprobante de la transferencia \(cobro 2\)/)).toBeTruthy()
    expect(llamadasA(ENTREGAR)).toHaveLength(0)

    await sacarFoto('Sacar foto del comprobante')
    await screen.findByText('Foto del comprobante cargada')
    await alResumen('Abel', { conCobro: true })
    // Pagó: "Firmar" es opcional, pero si la saca viaja como la foto del remito (evidencia).
    expect(screen.getByText('Opcional · foto del remito firmado')).toBeTruthy()
    await sacarFoto('Firmar')
    await screen.findByText('Remito firmado')
    await confirmarEntrega()

    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1]).toMatchObject({
      cobro: {
        imputacion: 'PedidoActual',
        lineas: [
          { medioPagoId: 'm-ef', monto: 600 },
          { medioPagoId: 'm-tr', monto: 400.5, fotoUrl: 'https://r2.test/entregas/1.jpg' },
        ],
      },
      evidenciaUrl: 'https://r2.test/entregas/2.jpg',
    })
    expect(llamadasA(ENTREGAR)[0][1].firma).toBeUndefined()
  })

  it('si la respuesta no llega, el reintento repite la misma clave y el mismo cuerpo', async () => {
    pintar()
    await abrirEntrega()
    await alResumen()
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    await confirmarEntrega()
    expect(await screen.findByText('Network request failed')).toBeTruthy()
    mockPost.mockImplementation(async () => { entregada(); return { paradaId: 'p1', repetida: true } })
    await confirmarEntrega()
    await cerrarListo()
    expect(await screen.findByText('1 de 2 entregadas')).toBeTruthy()
    const [primero, segundo] = llamadasA(ENTREGAR)
    expect(segundo[1]).toEqual(primero[1])
  })

  it('si la entrega ya había quedado registrada con otros datos, lo dice, cierra y muestra lo del servidor', async () => {
    mockPost.mockImplementation(async () => {
      entregada()
      throw Object.assign(new Error('Esta entrega ya se había registrado antes con otros datos.'), { status: 409, codigo: 'ClaveIdempotenciaConOtroCuerpo', errors: [] })
    })
    pintar()
    await abrirEntrega()
    await alResumen()
    await confirmarEntrega()
    expect(await screen.findByText('Esta entrega ya se había registrado antes con otros datos.')).toBeTruthy()
    expect(screen.queryByLabelText('Cerrar entrega')).toBeNull()
    expect(await screen.findByText('1 de 2 entregadas')).toBeTruthy()
  })

  it('si la clave ya se usó en otra parada, la cambia: el próximo intento va con otra clave', async () => {
    pintar()
    await abrirEntrega()
    await alResumen()
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Esta clave de idempotencia ya se usó en otra entrega.'), { status: 409, codigo: 'ClaveIdempotenciaConOtroCuerpo', errors: [] }))
    await confirmarEntrega()
    expect(await screen.findByText(/ya se usó en otra entrega/)).toBeTruthy()
    mockPost.mockResolvedValue({ paradaId: 'p1' })
    await confirmarEntrega()
    const [primero, segundo] = llamadasA(ENTREGAR)
    expect(segundo[1].claveIdempotencia).not.toBe(primero[1].claveIdempotencia)
  })

  // Cierre del bloque 9 (L5): el chofer solo tiene MOD_VIAJES; las líneas devolvibles salen de la
  // parada de su hoja (forward-system #971), no de Ventas.
  it('el chofer con solo viajes devuelve con las líneas de la parada y la entrega manda los renglones devueltos', async () => {
    mockPost.mockResolvedValue({ paradaId: 'p1' })
    pintar()
    await abrirEntrega(true)
    await userEvent.press(screen.getByLabelText('Sí'))
    await userEvent.press(await screen.findByLabelText('Sumar una de Aceite 900 ml'))
    await userEvent.press(screen.getByLabelText('Sumar una de Aceite 900 ml'))
    await continuar()
    await userEvent.press(await screen.findByLabelText('Seguir con el cobro'))
    await alResumen()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1]).toMatchObject({ devolucion: { items: [{ ventaDetalleId: 'd1', cantidad: 2 }] } })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/paradas/p1/lineas')
  })

  it('con permiso de ventas también usa las líneas de la parada: nunca pide devoluciones-posibles', async () => {
    pintar(HOJA, [{ module: 'MOD_VIAJES', canRead: true, canUpdate: true }, { module: 'MOD_VENTAS', canRead: true }])
    await abrirEntrega(true)
    await userEvent.press(screen.getByLabelText('Sí'))
    expect(await screen.findByLabelText('Sumar una de Aceite 900 ml')).toBeTruthy()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('devoluciones-posibles'))).toBe(false)
  })

  it('no se pudo entregar sigue por reportar-parada, con su clave y sin cobro', async () => {
    mockPost.mockResolvedValue(true)
    pintar()
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/reportar-parada', {
      hojaDeRutaId: 'h1', paradaId: 'p1', entregado: false, motivoRechazo: 'Cerrado o sin nadie', observaciones: undefined, claveIdempotencia: expect.stringMatching(/\S{8,}/),
    })
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })

  it('el reintento del aviso repite la misma clave y un aviso nuevo (otra parada) usa otra; el 409 de la clave se muestra', async () => {
    const REPORTAR = '/api/v1/Logistica/hojas-ruta/h1/reportar-parada'
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Falló el servidor.'), { status: 400, errors: [] }))
    pintar()
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    expect(await screen.findByText('Falló el servidor.')).toBeTruthy()
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Este reporte ya se había registrado con otros datos.'), { status: 409, codigo: 'ClaveIdempotenciaConOtroCuerpo', errors: [] }))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    expect(await screen.findByText('Este reporte ya se había registrado con otros datos.')).toBeTruthy()
    const llamadas = llamadasA(REPORTAR)
    expect(llamadas).toHaveLength(2)
    expect(llamadas[1][1].claveIdempotencia).toBe(llamadas[0][1].claveIdempotencia)
    mockPost.mockResolvedValue(true)
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    await waitFor(() => expect(llamadasA(REPORTAR)).toHaveLength(3))
    expect(llamadasA(REPORTAR)[2][1].claveIdempotencia).not.toBe(llamadas[0][1].claveIdempotencia)
  })
})

describe('Consola del chofer: hoja editada en la oficina', () => {
  it('con la ruta calculada muestra los km del recorrido que manda el servidor', async () => {
    pintar({ ...HOJA, distanciaTotalMetros: 12345 })
    expect(await screen.findByText('Recorrido 12,3 km')).toBeTruthy()
    expect(screen.queryByText(/Ruta sin recalcular/)).toBeNull()
  })

  it('si la oficina cambió paradas y no recalculó, avisa y no muestra km viejos', async () => {
    pintar({ ...HOJA, estado: 1, rutaCalculada: false, distanciaTotalMetros: 12345 })
    expect(await screen.findByText(/Ruta sin recalcular/)).toBeTruthy()
    expect(screen.queryByText(/km/)).toBeNull()
  })

  it('un servidor anterior (sin los campos) se ve como antes', async () => {
    const { rutaCalculada: _r, distanciaTotalMetros: _d, ...vieja } = HOJA
    pintar(vieja)
    await screen.findByLabelText('Próxima parada')
    expect(screen.queryByText(/Ruta sin recalcular/)).toBeNull()
    expect(screen.queryByText(/Recorrido/)).toBeNull()
  })
})
