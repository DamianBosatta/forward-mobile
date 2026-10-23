import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within, act, fireEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { reiniciarCamara, sacarFoto } from '@/features/logistica/__testing__/camara'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'
import { armarEntrega } from '../consola/entrega'

/**
 * Bloque 12, T12c: la entrega del chofer en los pasos del lienzo (E1 reportar, E2 devolución,
 * E3/E4 cobro y firma, E5 foto, E6 confirmar). Misma operación única `entregar` que antes.
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
const P1 = parada({ id: 'p1', ventaId: 'v1', orden: 1, direccion: 'Tarantino 1898', clienteNombre: 'Abel' })
const P1_CONTADO = { ...P1, tipoCobro: 'Contado', montoCobrar: 1000 }
const hoja = (p1: Record<string, unknown>, exigeFoto = false) => ({
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z', rutaCalculada: true, distanciaTotalMetros: 0, exigeFotoRemitoAlEntregar: exigeFoto,
  detalles: [p1, parada({ id: 'p2', ventaId: 'v2', orden: 2, direccion: 'Av. del Valle 89', clienteNombre: 'Chela' })],
})
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' },
  { id: 'm-tr', nombre: 'Transferencia', tipo: 'Transferencia' },
]
const RENGLONES = [
  { ventaDetalleId: 'd1', productoId: 'pr1', productoNombre: 'Aceite 900 ml', cantidadVendida: 6, cantidadDevuelta: 0, cantidadDisponible: 6 },
]

function pintar(h: Record<string, unknown>) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'C', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true, canUpdate: true }] },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(h)
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
const abrir = async () => userEvent.press(await screen.findByLabelText('Reportar entrega'))
const continuar = () => screen.getByLabelText('Continuar')
/** Entregado, sin devolución, hasta el paso de cobro (E3). */
async function hastaElCobro(receptor = 'Abel') {
  await userEvent.type(screen.getByLabelText('Quién recibió'), receptor)
  await userEvent.press(screen.getByLabelText('No, recibió todo'))
  await userEvent.press(continuar())
}
/** Hasta el resumen (E6), sin devolución y sin cobro. */
async function hastaElResumen(receptor = 'Abel') {
  await hastaElCobro(receptor)
  await userEvent.press(continuar())
}
const CHEQUE_VACIO = { numero: '', banco: '', titular: '', emision: '', pago: '' }
const deshabilitado =(el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true

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

describe('E1 Reportar entrega', () => {
  it('no sigue sin elegir si hay devolución y lo dice', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Elegí si hay devolución')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('No, recibió todo'))
    expect(deshabilitado(continuar())).toBe(false)
  })

  it('quién recibió es obligatorio para seguir', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('No, recibió todo'))
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta quién recibió')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Quién recibió'), '   ')
    expect(deshabilitado(continuar())).toBe(true)
  })

  it('con la foto del remito exigida no sigue sin ella; al sacarla sigue', async () => {
    pintar(hoja(P1, true))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('No, recibió todo'))
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto del remito')).toBeTruthy()
    await sacarFoto('Sacar foto del remito firmado')
    await screen.findByText('Foto del remito firmado cargada')
    expect(deshabilitado(continuar())).toBe(false)
  })

  it('sin la exigencia, la foto del remito es opcional y se puede seguir sin ella', async () => {
    pintar(hoja(P1, false))
    await abrir()
    await hastaElCobro()
    expect(screen.getByText('Cobro mixto')).toBeTruthy()
  })

  it('la foto se saca con la cámara, sin galería, y lo dice', async () => {
    pintar(hoja(P1, true))
    await abrir()
    expect(screen.getByText(/Sin galería: la foto se saca ahora, para que no se pueda usar una vieja/)).toBeTruthy()
  })
})

describe('E2 Devolución', () => {
  it('"Sí, devuelve" muestra la devolución y pide al menos un producto', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    expect(screen.getByText('¿Qué devuelve?')).toBeTruthy()
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Indicá qué devuelve')).toBeTruthy()
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '2')
    expect(deshabilitado(continuar())).toBe(false)
    await userEvent.press(continuar())
    expect(screen.getByText('Cobro mixto')).toBeTruthy()
  })

  it('no deja devolver más de lo que se puede', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '7')
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Se devuelve más de lo que se puede devolver de un producto.')).toBeTruthy()
  })
})

describe('E3 Cobro mixto', () => {
  const cargarEfectivo = async (monto: string, n = 1) => {
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(await screen.findByLabelText(`Medio del cobro ${n}`)).getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText(`Monto del cobro ${n}`), monto)
  }

  it('lo cobrado que no suma "A cobrar hoy" avisa en rojo (Faltan / Sobran) y deja continuar', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    expect(within(screen.getByLabelText('A cobrar hoy')).getByText('$ 1.000,00')).toBeTruthy()
    await cargarEfectivo('600')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.getByText('Faltan $ 400,00')).toBeTruthy()
    await userEvent.clear(screen.getByLabelText('Monto del cobro 1'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '1200')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.getByText('Sobran $ 200,00')).toBeTruthy()
    await userEvent.clear(screen.getByLabelText('Monto del cobro 1'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '1000')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.queryByText(/^(Faltan|Sobran)/)).toBeNull()
    expect(screen.getByText('$ 1.000,00 de $ 1.000,00 ✓')).toBeTruthy()
  })

  it('cobro parcial sin firma (600 de 1000): se confirma y el cuerpo es el de armarEntrega', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('600')
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const esperado = armarEntrega(
      { receptor: 'Abel', observaciones: '', remitoUrl: null, imputacion: 'PedidoActual', devolucion: {}, firmaUrl: null,
        lineas: [{ medio: MEDIOS[0] as never, monto: '600', fotoUrl: null, cheque: CHEQUE_VACIO }] },
      { exigeFotoRemito: false, disponibles: { d1: 6 } },
    )
    if (!('entrega' in esperado)) throw new Error(esperado.error)
    expect(llamadasA(ENTREGAR)[0][1]).toEqual({ claveIdempotencia: expect.stringMatching(/\S{8,}/), ...esperado.entrega })
  })

  it('cobrar de más (1500 de 1000, al pedido actual): avisa Sobran, deja continuar y el cuerpo es el de armarEntrega', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('1500')
    expect(screen.getByText('Sobran $ 500,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    expect(screen.getByText('Sobran $ 500,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    expect(deshabilitado(continuar())).toBe(false)
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const esperado = armarEntrega(
      { receptor: 'Abel', observaciones: '', remitoUrl: null, imputacion: 'PedidoActual', devolucion: {}, firmaUrl: null,
        lineas: [{ medio: MEDIOS[0] as never, monto: '1500', fotoUrl: null, cheque: CHEQUE_VACIO }] },
      { exigeFotoRemito: false, disponibles: { d1: 6 } },
    )
    if (!('entrega' in esperado)) throw new Error(esperado.error)
    expect(llamadasA(ENTREGAR)[0][1]).toEqual({ claveIdempotencia: expect.stringMatching(/\S{8,}/), ...esperado.entrega })
  })

  it('con firma, lo que falta queda en la cuenta corriente: alcanza con cobrar menos', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('600')
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    // La firma va siempre con su foto.
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto de la firma')).toBeTruthy()
    expect(screen.queryByText(/^Faltan/)).toBeNull()
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    expect(deshabilitado(continuar())).toBe(false)
  })

  it('si se destilda la firma con su foto subiendo, la foto tardía no viaja', async () => {
    let soltar: (v: { url: string }) => void = () => {}
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('1000')
    mockPost.mockImplementation((url: string) =>
      url === '/api/v1/Media/upload-entrega' ? new Promise((r) => { soltar = r }) : Promise.resolve({ paradaId: 'p1' }),
    )
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await act(async () => { soltar({ url: 'https://r2.test/entregas/tarde.jpg' }) })
    await waitFor(() => expect(deshabilitado(continuar())).toBe(false))
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const cuerpo = llamadasA(ENTREGAR)[0][1] as Record<string, unknown>
    expect(cuerpo.firma).toBeUndefined()
    expect(JSON.stringify(cuerpo)).not.toContain('tarde.jpg')
  })

  it('la transferencia no sigue sin la foto del comprobante', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(await screen.findByLabelText('Medio del cobro 1')).getByLabelText('Transferencia'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '1000')
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto del comprobante de la transferencia (cobro 1).')).toBeTruthy()
    await sacarFoto('Sacar foto del comprobante del cobro 1')
    await screen.findByText('Foto del comprobante del cobro 1 cargada')
    expect(deshabilitado(continuar())).toBe(false)
  })

  it('sin cobrar nada se sigue: el pedido queda en la cuenta del cliente', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    expect(deshabilitado(continuar())).toBe(false)
  })

  it('E4: pagar la deuda anterior cambia el paso a "Paga lo anterior y firma lo actual" y no compara con lo de hoy', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('8500')
    expect(screen.getByText('Sobran $ 7.500,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('A la deuda anterior'))
    expect(screen.queryByText(/^(Faltan|Sobran)/)).toBeNull()
    expect(screen.getByText('Paga lo anterior y firma lo actual')).toBeTruthy()
    expect(deshabilitado(continuar())).toBe(false)
  })
})

describe('Volver conserva lo cargado', () => {
  it('de cobro a devolución a reporte, nada se pierde', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '2')
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(await screen.findByLabelText('Medio del cobro 1')).getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '800')

    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByLabelText('Devuelve: Aceite 900 ml').props.value).toBe('2')
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByLabelText('Quién recibió').props.value).toBe('Abel')
    expect(screen.getByLabelText('Sí, devuelve').props.accessibilityState.checked).toBe(true)
    await userEvent.press(continuar())
    await userEvent.press(continuar())
    expect(screen.getByLabelText('Monto del cobro 1').props.value).toBe('800')
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })

  it('"No" a la devolución después de haber cargado cantidades no las manda', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '2')
    await userEvent.press(screen.getByLabelText('Volver'))
    await userEvent.press(screen.getByLabelText('No, recibió todo'))
    await userEvent.press(continuar())
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1].devolucion).toBeUndefined()
  })

  it('en el primer paso, volver cierra el reporte', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.queryByLabelText('Quién recibió')).toBeNull()
  })
})

describe('E6 Confirmar entrega', () => {
  it('el resumen dice quién recibió, la devolución por autorizar y el cobro', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Graciela Ruiz')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '2')
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(await screen.findByLabelText('Medio del cobro 1')).getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '800')
    await userEvent.press(continuar())
    const r = screen.getByLabelText('Resumen de la entrega')
    expect(within(r).getByText('Graciela Ruiz')).toBeTruthy()
    expect(within(r).getByText('Por autorizar en depósito')).toBeTruthy()
    expect(within(r).getByText('2 × Aceite 900 ml')).toBeTruthy()
    expect(within(r).getByText('Efectivo')).toBeTruthy()
    expect(within(r).getByText('$ 800,00')).toBeTruthy()
  })

  it('el cuerpo que viaja es el mismo que arma armarEntrega con los mismos datos, más la clave', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Abel')
    await userEvent.press(screen.getByLabelText('Sí, devuelve'))
    await userEvent.press(continuar())
    await userEvent.type(await screen.findByLabelText('Devuelve: Aceite 900 ml'), '2')
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(await screen.findByLabelText('Medio del cobro 1')).getByLabelText('Efectivo'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '700')
    await userEvent.press(screen.getByLabelText('Agregar cobro'))
    await userEvent.press(within(screen.getByLabelText('Medio del cobro 2')).getByLabelText('Transferencia'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 2'), '100')
    await sacarFoto('Sacar foto del comprobante del cobro 2')
    await screen.findByText('Foto del comprobante del cobro 2 cargada')
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    await userEvent.press(continuar())
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))

    const cheque = { numero: '', banco: '', titular: '', emision: '', pago: '' }
    const esperado = armarEntrega(
      {
        receptor: 'Abel', observaciones: '', remitoUrl: null, imputacion: 'PedidoActual', devolucion: { d1: '2' },
        firmaUrl: 'https://r2.test/entregas/up-2.jpg',
        lineas: [
          { medio: MEDIOS[0] as never, monto: '700', fotoUrl: null, cheque },
          { medio: MEDIOS[1] as never, monto: '100', fotoUrl: 'https://r2.test/entregas/up-1.jpg', cheque },
        ],
      },
      { exigeFotoRemito: false, disponibles: { d1: 6 } },
    )
    if (!('entrega' in esperado)) throw new Error(esperado.error)
    expect(llamadasA(ENTREGAR)[0][1]).toEqual({ claveIdempotencia: expect.stringMatching(/\S{8,}/), ...esperado.entrega })
  })

  it('un doble toque en confirmar manda una sola entrega', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    pintar(hoja(P1))
    await abrir()
    await hastaElResumen()
    const confirmar = screen.getByLabelText('Confirmar entrega')
    act(() => {
      fireEvent.press(confirmar)
      fireEvent.press(confirmar)
    })
    await act(async () => {})
    expect(llamadasA(ENTREGAR)).toHaveLength(1)
  })

  it('si falla, el error se ve en el resumen y el reintento repite la clave y el cuerpo', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElResumen()
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    expect(await screen.findByText('Network request failed')).toBeTruthy()
    expect(screen.getByLabelText('Resumen de la entrega')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(2))
    const [primero, segundo] = llamadasA(ENTREGAR)
    expect(segundo[1]).toEqual(primero[1])
    expect(primero[1].claveIdempotencia).toBeTruthy()
  })
})

describe('No se pudo entregar', () => {
  it('se confirma desde el primer paso, sin pasar por devolución ni cobro', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('No se pudo entregar'))
    expect(screen.queryByLabelText('Continuar')).toBeNull()
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await userEvent.press(screen.getByLabelText('Confirmar: no se entregó'))
    await waitFor(() => expect(llamadasA('/api/v1/Logistica/hojas-ruta/h1/reportar-parada')).toHaveLength(1))
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })
})
