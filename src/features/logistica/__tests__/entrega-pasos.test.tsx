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
const abrir = async () => {
  await userEvent.press(await screen.findByLabelText('¡Llegué!'))
  await userEvent.press(await screen.findByLabelText('Entregué todo'))
}
const continuar = () => screen.getByLabelText('Continuar')
const confirmarBtn = () => screen.getByLabelText('Confirmar entrega')
/** Entregado, "No, todo bien": cae directo en el cobro. */
async function hastaElCobro() {
  await userEvent.press(screen.getByLabelText('No, todo bien'))
}
/** Del cobro al paso Confirmar, con quién recibió escrito. */
async function aConfirmar(receptor = 'Abel') {
  await userEvent.press(continuar())
  if (receptor) await userEvent.type(screen.getByLabelText('Quién recibió'), receptor)
}
/** Hasta Confirmar, sin devolución y sin cobro. */
async function hastaElResumen(receptor = 'Abel') {
  await hastaElCobro()
  await aConfirmar(receptor)
}
/** "Sí, devuelve algo" y 2 unidades de aceite. */
async function devolverDos() {
  await userEvent.press(screen.getByLabelText('Sí, devuelve algo'))
  await userEvent.press(await screen.findByLabelText('Sumar una de Aceite 900 ml'))
  await userEvent.press(screen.getByLabelText('Sumar una de Aceite 900 ml'))
}
/** Un pago: la primera vez se elige el medio directo; las siguientes, con "Sumar otro pago". */
async function sumarPago(medio: string, monto: string, n = 1) {
  if (n > 1) await userEvent.press(screen.getByLabelText('Sumar otro pago'))
  await userEvent.press(screen.getByLabelText(medio))
  await userEvent.type(screen.getByLabelText(`Monto del cobro ${n}`), monto)
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

describe('Paso 2: devoluciones', () => {
  it('pregunta primero y no avanza hasta que el chofer elige: sin botón Continuar', async () => {
    pintar(hoja(P1))
    await abrir()
    expect(screen.getByText('¿Tiene devoluciones?')).toBeTruthy()
    expect(screen.getByLabelText('No, todo bien')).toBeTruthy()
    expect(screen.getByLabelText('Sí, devuelve algo')).toBeTruthy()
    expect(screen.queryByLabelText('Continuar')).toBeNull()
    expect(screen.getByText(/Paso 2 de 4/)).toBeTruthy()
  })

  it('"No, todo bien" salta al cobro y el total sigue en 4: el contador no retrocede', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    expect(screen.getByLabelText('Cobro')).toBeTruthy()
    expect(screen.getByText(/Paso 3 de 4 · Cobro/)).toBeTruthy()
  })

  it('el contador recorre 2, 3, 4 de 4 sin repetir número ni cambiar el total, con o sin devolución', async () => {
    pintar(hoja(P1))
    await abrir()
    expect(screen.getByText(/Paso 2 de 4 · Devoluciones/)).toBeTruthy()
    await hastaElCobro()
    expect(screen.getByText(/Paso 3 de 4 · Cobro/)).toBeTruthy()
    await aConfirmar()
    expect(screen.getByText(/Paso 4 de 4 · Confirmar/)).toBeTruthy()
  })

  it('"Sí, devuelve algo" muestra los productos y pide al menos una unidad', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Sí, devuelve algo'))
    expect(screen.getByText('¿Qué devuelve?')).toBeTruthy()
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Indicá qué devuelve')).toBeTruthy()
    await userEvent.press(await screen.findByLabelText('Sumar una de Aceite 900 ml'))
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.getByText('Devuelve 1 unidad en 1 producto')).toBeTruthy()
    await userEvent.press(continuar())
    expect(screen.getByLabelText('Cobro')).toBeTruthy()
  })

  it('el contador no deja devolver más de lo que se puede (tope en lo disponible)', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Sí, devuelve algo'))
    const mas = await screen.findByLabelText('Sumar una de Aceite 900 ml')
    for (let k = 0; k < 8; k++) await userEvent.press(mas)
    expect(screen.getByLabelText('Cantidad de Aceite 900 ml: 6')).toBeTruthy()
  })
})

describe('Paso Confirmar: quién recibió y foto del remito', () => {
  it('quién recibió es obligatorio para confirmar', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await aConfirmar('')
    expect(deshabilitado(confirmarBtn())).toBe(true)
    expect(screen.getByText('Falta quién recibió')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Quién recibió'), '   ')
    expect(deshabilitado(confirmarBtn())).toBe(true)
  })

  it('con la foto del remito exigida no confirma sin ella; al sacarla confirma', async () => {
    pintar(hoja(P1, true))
    await abrir()
    await hastaElResumen()
    expect(deshabilitado(confirmarBtn())).toBe(true)
    expect(screen.getByText('Falta la foto del remito')).toBeTruthy()
    await sacarFoto('Sacar foto del remito firmado')
    await screen.findByText('Foto del remito firmado cargada')
    expect(deshabilitado(confirmarBtn())).toBe(false)
  })

  it('sin la exigencia, la foto del remito es opcional y se puede confirmar sin ella', async () => {
    pintar(hoja(P1, false))
    await abrir()
    await hastaElResumen()
    expect(deshabilitado(confirmarBtn())).toBe(false)
  })

  it('la foto se saca con la cámara, sin galería, y lo dice', async () => {
    pintar(hoja(P1, true))
    await abrir()
    await hastaElResumen('')
    expect(screen.getByText(/Sin galería: la foto se saca ahora, para que no se pueda usar una vieja/)).toBeTruthy()
  })
})

describe('E3 Cobro mixto', () => {
  const cargarEfectivo = (monto: string, n = 1) => sumarPago('Efectivo', monto, n)

  it('lo cobrado que no suma "A cobrar hoy" avisa (queda en la cuenta / Sobran) y deja continuar', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    expect(within(screen.getByLabelText('A cobrar hoy')).getByText('$ 1.000,00')).toBeTruthy()
    await cargarEfectivo('600')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.getByText('Los $ 400,00 que faltan quedan en su cuenta corriente.')).toBeTruthy()
    await userEvent.clear(screen.getByLabelText('Monto del cobro 1'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '1200')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.getByText('Sobran $ 200,00')).toBeTruthy()
    await userEvent.clear(screen.getByLabelText('Monto del cobro 1'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '1000')
    expect(deshabilitado(continuar())).toBe(false)
    expect(screen.queryByText(/^(Los .* que faltan|Sobran)/)).toBeNull()
    const contador = screen.getByLabelText('Cobrado y falta')
    expect(within(contador).getAllByText('$ 1.000,00').length).toBeGreaterThanOrEqual(1)
    expect(within(contador).getByText('$ 0,00')).toBeTruthy()
  })

  it('cobro parcial sin firma (600 de 1000): se confirma y el cuerpo es el de armarEntrega', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('600')
    await aConfirmar()
    await userEvent.press(confirmarBtn())
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
    expect(deshabilitado(continuar())).toBe(false)
    await aConfirmar()
    await userEvent.press(confirmarBtn())
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const esperado = armarEntrega(
      { receptor: 'Abel', observaciones: '', remitoUrl: null, imputacion: 'PedidoActual', devolucion: {}, firmaUrl: null,
        lineas: [{ medio: MEDIOS[0] as never, monto: '1500', fotoUrl: null, cheque: CHEQUE_VACIO }] },
      { exigeFotoRemito: false, disponibles: { d1: 6 } },
    )
    if (!('entrega' in esperado)) throw new Error(esperado.error)
    expect(llamadasA(ENTREGAR)[0][1]).toEqual({ claveIdempotencia: expect.stringMatching(/\S{8,}/), ...esperado.entrega })
  })

  it('S4: la firma nunca bloquea (se confirma sin su foto) pero la foto del remito exigida sí', async () => {
    pintar(hoja(P1_CONTADO, true))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('600')
    await aConfirmar()
    await sacarFoto('Sacar foto del remito firmado')
    await screen.findByText('Foto del remito firmado cargada')
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    // Firma tildada y sin foto: no frena ni avisa que falta la foto de la firma.
    expect(deshabilitado(confirmarBtn())).toBe(false)
    expect(screen.queryByText('Falta la foto de la firma')).toBeNull()
    expect(screen.getByText('Foto de la firma: opcional')).toBeTruthy()
    await userEvent.press(confirmarBtn())
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const cuerpo = llamadasA(ENTREGAR)[0][1] as Record<string, unknown>
    expect(cuerpo.firma).toBeUndefined()
    expect(cuerpo.evidenciaUrl).toMatch(/entregas\/up-/)
  })

  it('S4: sin la foto del remito exigida no se confirma, aunque la firma esté tildada', async () => {
    pintar(hoja(P1_CONTADO, true))
    await abrir()
    await hastaElResumen()
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    expect(deshabilitado(confirmarBtn())).toBe(true)
    expect(screen.getByText('Falta la foto del remito')).toBeTruthy()
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })

  it('si se destilda la firma con su foto subiendo, la foto tardía no viaja', async () => {
    let soltar: (v: { url: string }) => void = () => {}
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('1000')
    await aConfirmar()
    mockPost.mockImplementation((url: string) =>
      url === '/api/v1/Media/upload-entrega' ? new Promise((r) => { soltar = r }) : Promise.resolve({ paradaId: 'p1' }),
    )
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await act(async () => { soltar({ url: 'https://r2.test/entregas/tarde.jpg' }) })
    await waitFor(() => expect(deshabilitado(confirmarBtn())).toBe(false))
    await userEvent.press(confirmarBtn())
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const cuerpo = llamadasA(ENTREGAR)[0][1] as Record<string, unknown>
    expect(cuerpo.firma).toBeUndefined()
    expect(JSON.stringify(cuerpo)).not.toContain('tarde.jpg')
  })

  it('la transferencia no sigue sin la foto del comprobante', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Transferencia', '1000')
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

  it('E4: pagar la deuda anterior lo avisa y no compara con lo de hoy', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await cargarEfectivo('8500')
    expect(screen.getByText('Sobran $ 7.500,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('A la deuda anterior'))
    expect(screen.queryByText(/^(Los .* que faltan|Sobran)/)).toBeNull()
    expect(screen.getByText('El cobro va a la deuda más vieja del cliente. Lo de hoy queda en su cuenta corriente.')).toBeTruthy()
    expect(deshabilitado(continuar())).toBe(false)
  })
})

describe('Volver conserva lo cargado', () => {
  it('de confirmar a cobro a devoluciones, nada se pierde', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await devolverDos()
    await userEvent.press(continuar())
    await sumarPago('Efectivo', '800')
    await aConfirmar()

    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByLabelText('Monto del cobro 1').props.value).toBe('800')
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByLabelText('Cantidad de Aceite 900 ml: 2')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByText('¿Tiene devoluciones?')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Sí, devuelve algo'))
    expect(screen.getByLabelText('Cantidad de Aceite 900 ml: 2')).toBeTruthy()
    await userEvent.press(continuar())
    expect(screen.getByLabelText('Monto del cobro 1').props.value).toBe('800')
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })

  it('"No, todo bien" después de haber cargado cantidades no las manda', async () => {
    pintar(hoja(P1))
    await abrir()
    await devolverDos()
    await userEvent.press(screen.getByLabelText('Volver'))
    await userEvent.press(screen.getByLabelText('No, todo bien'))
    await aConfirmar()
    await userEvent.press(confirmarBtn())
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(llamadasA(ENTREGAR)[0][1].devolucion).toBeUndefined()
  })

  it('en el primer paso, volver cierra el reporte', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.queryByLabelText('No, todo bien')).toBeNull()
  })
})

describe('E6 Confirmar entrega', () => {
  it('el resumen dice quién recibió, la devolución por autorizar y el cobro', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await devolverDos()
    await userEvent.press(continuar())
    await sumarPago('Efectivo', '800')
    await aConfirmar('Graciela Ruiz')
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
    await devolverDos()
    await userEvent.press(continuar())
    await sumarPago('Efectivo', '700')
    await sumarPago('Transferencia', '100', 2)
    await sacarFoto('Sacar foto del comprobante del cobro 2')
    await screen.findByText('Foto del comprobante del cobro 2 cargada')
    await aConfirmar()
    await userEvent.press(screen.getByLabelText('Firma del cliente'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    await userEvent.press(confirmarBtn())
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
    const confirmar = confirmarBtn()
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
    await userEvent.press(confirmarBtn())
    expect(await screen.findByText('Network request failed')).toBeTruthy()
    expect(screen.getByLabelText('Resumen de la entrega')).toBeTruthy()
    await userEvent.press(confirmarBtn())
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(2))
    const [primero, segundo] = llamadasA(ENTREGAR)
    expect(segundo[1]).toEqual(primero[1])
    expect(primero[1].claveIdempotencia).toBeTruthy()
  })
})

describe('No se pudo entregar', () => {
  it('se confirma desde el primer paso, sin pasar por devolución ni cobro', async () => {
    pintar(hoja(P1))
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    expect(screen.queryByLabelText('Continuar')).toBeNull()
    expect(screen.getByText('¿Por qué no pudiste entregar?')).toBeTruthy()
    expect(screen.getByText('No había quién recibiera')).toBeTruthy()
    expect(screen.getByText('No la quiso recibir')).toBeTruthy()
    expect(screen.getByText('No encontraste el lugar')).toBeTruthy()
    expect(screen.getByText('Contanos qué pasó')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Cerrado o sin nadie'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    await waitFor(() => expect(llamadasA('/api/v1/Logistica/hojas-ruta/h1/reportar-parada')).toHaveLength(1))
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
  })
})
