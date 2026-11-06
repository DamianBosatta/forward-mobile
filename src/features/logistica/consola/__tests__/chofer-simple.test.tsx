import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within, act, fireEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { reiniciarCamara, sacarFoto } from '@/features/logistica/__testing__/camara'
import { confirmarEntrega } from '@/features/logistica/__testing__/confirmar'
import { themeColors } from '@/libs/theme'
import ConsolaChoferScreen from '@/app/(tabs)/logistica/consola'

/**
/** Consola del chofer simplificada (T8, S10-S19). */

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
// Un servidor viejo todavía manda Tarjeta: el chofer no la ve.
const MEDIOS_BASE = [
  { id: 'm-tj', nombre: 'Tarjeta', tipo: 'Tarjeta' },
  { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' },
  { id: 'm-tr', nombre: 'Transferencia', tipo: 'Transferencia' },
  { id: 'm-ch', nombre: 'Cheque', tipo: 'Cheque' },
]
let MEDIOS: Record<string, unknown>[] = MEDIOS_BASE
let RENGLONES: Record<string, unknown>[] = [
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
  await userEvent.press(screen.getByLabelText('No'))
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
  await userEvent.press(screen.getByLabelText('Sí'))
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
  MEDIOS = MEDIOS_BASE
  let subidas = 0
  mockPost.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Media/upload-entrega') return { url: `https://r2.test/entregas/up-${++subidas}.jpg` }
    return { paradaId: 'p1' }
  })
  RENGLONES = [
    { ventaDetalleId: 'd1', productoId: 'pr1', productoNombre: 'Aceite 900 ml', cantidadVendida: 6, cantidadDevuelta: 0, cantidadDisponible: 6 },
  ]
})

const cuerpoEntrega = () => llamadasA(ENTREGAR)[0][1] as Record<string, unknown>
const OPCIONES = ['Efectivo', 'Transferencia', 'Cheque', 'Firma']

describe('S11 devoluciones: sí o no', () => {
  it('la pregunta tiene dos respuestas grandes, Sí y No, y nada más para elegir', async () => {
    pintar(hoja(P1))
    await abrir()
    expect(screen.getByText('¿Tiene devoluciones?')).toBeTruthy()
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['No', 'Sí'])
    expect(screen.queryByLabelText('Continuar')).toBeNull()
    expect(screen.queryByText(/Tocá una y pasás/)).toBeNull()
  })
  it('Sí muestra los productos', async () => {
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Sí'))
    expect(await screen.findByText('¿Qué devuelve?')).toBeTruthy()
  })
})

describe('S12 buscador en la devolución', () => {
  const muchas = (n: number) => Array.from({ length: n }, (_, i) => ({
    ventaDetalleId: `d${i}`, productoId: `p${i}`, productoNombre: i === 3 ? 'Yerba Taragüí 1 kg' : `Galletitas ${i}`, cantidadVendida: 2, cantidadDevuelta: 0, cantidadDisponible: 2,
  }))
  it('con 8 renglones aparece el buscador y filtra por nombre', async () => {
    RENGLONES = muchas(8)
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Sí'))
    await userEvent.type(await screen.findByLabelText('Buscar producto o marca'), 'tarag')
    expect(screen.getByText('Yerba Taragüí 1 kg')).toBeTruthy()
    expect(screen.queryByText('Galletitas 0')).toBeNull()
  })
  it('con 7 renglones no hay buscador', async () => {
    RENGLONES = muchas(7)
    pintar(hoja(P1))
    await abrir()
    await userEvent.press(screen.getByLabelText('Sí'))
    await screen.findByText('Galletitas 0')
    expect(screen.queryByLabelText('Buscar producto o marca')).toBeNull()
  })
})

describe('S13 formas de pago', () => {
  it('ofrece exactamente Efectivo, Transferencia, Cheque y Firma, aunque el servidor mande Tarjeta, y no hay Cuenta corriente', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await screen.findByText('¿Cómo paga?')
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(OPCIONES)
    expect(screen.queryByLabelText('Tarjeta')).toBeNull()
    expect(screen.queryByLabelText('Cuenta corriente')).toBeNull()
    expect(screen.queryByText(/Queda en cuenta corriente/)).toBeNull()
  })
  it('Sumar otro pago ofrece las mismas cuatro', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '400')
    await userEvent.press(screen.getByLabelText('Sumar otro pago'))
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(OPCIONES)
  })
  it('Firma pide la foto, no manda cobro y va como firma de la entrega', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(await screen.findByLabelText('Firma'))
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto de la firma')).toBeTruthy()
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    expect(deshabilitado(continuar())).toBe(false)
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().firma).toEqual({ fotoUrl: expect.stringMatching(/entregas\/up-/) })
    expect(cuerpoEntrega().cobro).toBeUndefined()
  })
  it('cobro mixto con Firma: lo pagado viaja en las líneas y el resto queda con la firma', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '400')
    await userEvent.press(screen.getByLabelText('Sumar otro pago'))
    await userEvent.press(screen.getByLabelText('Firma'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 400 }] })
    expect(cuerpoEntrega().firma).toBeDefined()
  })
  it('quitar la Firma la saca del cuerpo', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await userEvent.press(await screen.findByLabelText('Firma'))
    await sacarFoto('Sacar foto de la firma del cliente')
    await screen.findByText('Foto de la firma del cliente cargada')
    await userEvent.press(screen.getByLabelText('Quitar firma'))
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().firma).toBeUndefined()
  })
  it('la transferencia sigue pidiendo la foto del comprobante', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Transferencia', '1000')
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto del comprobante de la transferencia (cobro 1).')).toBeTruthy()
  })
})

describe('S13b un solo Transferencia aunque el servidor mande dos', () => {
  // Servidor real: dos medios de tipo Transferencia, ordenados por nombre.
  const MEDIOS_REALES = [
    { id: 'm-tb', nombre: 'Tarjeta / Billetera virtual', tipo: 'Transferencia' },
    { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' },
    { id: 'm-tr-banc', nombre: 'Transferencia bancaria', tipo: 'Transferencia' },
    { id: 'm-ch', nombre: 'Cheque', tipo: 'Cheque' },
  ]
  const titulos = () => screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)
  it('¿Cómo paga? ofrece cuatro opciones, sin Tarjeta ni Billetera virtual', async () => {
    MEDIOS = MEDIOS_REALES
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await screen.findByText('¿Cómo paga?')
    expect(titulos()).toEqual(OPCIONES)
    expect(screen.queryByText(/tarjeta|billetera virtual$/i)).toBeNull()
    expect(screen.getByText('Bancaria o billetera · Foto del comprobante')).toBeTruthy()
  })
  it('Sumar otro pago ofrece las mismas cuatro', async () => {
    MEDIOS = MEDIOS_REALES
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '400')
    await userEvent.press(screen.getByLabelText('Sumar otro pago'))
    expect(titulos()).toEqual(OPCIONES)
  })
  it('el pago viaja con el id de Transferencia bancaria, la tarjeta dice Transferencia y pide la foto', async () => {
    MEDIOS = MEDIOS_REALES
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Transferencia', '1000')
    expect(screen.queryByText(/tarjeta|billetera virtual$/i)).toBeNull()
    expect(within(screen.getByLabelText('Medio del cobro 1')).getByText('Transferencia')).toBeTruthy()
    expect(deshabilitado(continuar())).toBe(true)
    expect(screen.getByText('Falta la foto del comprobante de la transferencia (cobro 1).')).toBeTruthy()
    await sacarFoto('Sacar foto del comprobante del cobro 1')
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    const cobro = cuerpoEntrega().cobro as { lineas: { medioPagoId: string }[] }
    expect(cobro.lineas.map((l) => l.medioPagoId)).toEqual(['m-tr-banc'])
  })
})

describe('S14 y S17 sin cuenta corriente ni imputación', () => {
  it('no hay selector de deuda anterior ni "paga lo anterior"; el cuerpo lleva la imputación por defecto', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '1000')
    expect(screen.queryByLabelText('A qué deuda va el cobro')).toBeNull()
    expect(screen.queryByText('A la deuda anterior')).toBeNull()
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 1000 }] })
    expect(cuerpoEntrega().observaciones).toBeUndefined()
  })
})

describe('S15 quién recibió opcional', () => {
  it('se confirma sin nombre y no viaja nombreReceptor', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await aConfirmar('')
    expect(screen.queryByText('Falta quién recibió')).toBeNull()
    expect(deshabilitado(confirmarBtn())).toBe(false)
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().nombreReceptor).toBeUndefined()
  })
})

describe('S16 devolución solo marcada', () => {
  it('viaja con sus renglones y sin pasos extra', async () => {
    pintar(hoja(P1))
    await abrir()
    await devolverDos()
    await userEvent.press(screen.getByLabelText('Continuar'))
    await userEvent.press(await screen.findByLabelText('Seguir con el cobro'))
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().devolucion).toEqual({ items: [{ ventaDetalleId: 'd1', cantidad: 2 }] })
  })
})

describe('S18 deuda anterior en rojo', () => {
  it('con deudaAnterior mayor a cero se ve en rojo con el importe, sin botón extra', async () => {
    pintar(hoja({ ...P1_CONTADO, deudaAnterior: 100 }))
    await abrir()
    await hastaElCobro()
    const linea = await screen.findByLabelText('Deuda anterior')
    expect(within(linea).getByText('Deuda anterior $ 100,00')).toBeTruthy()
    expect(within(linea).getByText('Deuda anterior $ 100,00')).toHaveStyle({ color: themeColors.light.danger })
    expect(screen.queryByLabelText(/pagar la deuda/i)).toBeNull()
  })
  it('sin el campo (servidor anterior) o en cero no hay línea', async () => {
    pintar(hoja({ ...P1_CONTADO, deudaAnterior: 0 }))
    await abrir()
    await hastaElCobro()
    await screen.findByText('¿Cómo paga?')
    expect(screen.queryByLabelText('Deuda anterior')).toBeNull()
  })
})

describe('S19 pantallas nuevas', () => {
  it('Devolución enviada: aparece al seguir desde los productos y "Seguir con el cobro" lleva al cobro', async () => {
    pintar(hoja(P1))
    await abrir()
    await devolverDos()
    await userEvent.press(screen.getByLabelText('Continuar'))
    expect(await screen.findByText('Devolución enviada')).toBeTruthy()
    expect(screen.getByText('Depósito la va a autorizar cuando reciba la mercadería. Seguí con el cobro.')).toBeTruthy()
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
    await userEvent.press(screen.getByLabelText('Seguir con el cobro'))
    expect(await screen.findByText('¿Cómo paga?')).toBeTruthy()
  })
  it('Efectivo con vuelto: "Te dio" calcula el vuelto, "Justo" lo borra, y nada de eso viaja', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '600')
    await userEvent.press(screen.getByLabelText('Te dio'))
    await userEvent.type(screen.getByLabelText('Te dio (cobro 1)'), '1000')
    expect(screen.getByText('Su vuelto $ 400,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Justo'))
    expect(screen.queryByText(/Su vuelto/)).toBeNull()
    await userEvent.press(screen.getByLabelText('Te dio'))
    await userEvent.type(screen.getByLabelText('Te dio (cobro 1)'), '1000')
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 600 }] })
    expect(JSON.stringify(cuerpoEntrega())).not.toMatch(/recibido|vuelto/i)
  })
  it('¿Confirmás la entrega?: pide confirmar con quién recibió y lo cobrado; Revisar no manda nada', async () => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', '1000')
    await aConfirmar('Marta Gómez')
    await userEvent.press(confirmarBtn())
    expect(await screen.findByText('¿Confirmás la entrega?')).toBeTruthy()
    expect(screen.getByText('Después no se puede deshacer. Recibió Marta Gómez · cobrado $ 1.000,00.')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Revisar'))
    expect(llamadasA(ENTREGAR)).toHaveLength(0)
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().nombreReceptor).toBe('Marta Gómez')
  })
  it('un doble toque en "Sí, confirmar" manda una sola entrega', async () => {
    pintar(hoja(P1))
    await abrir()
    await hastaElCobro()
    await aConfirmar()
    await userEvent.press(confirmarBtn())
    const si = await screen.findByLabelText('Sí, confirmar')
    fireEvent.press(si)
    fireEvent.press(si)
    await waitFor(() => expect(llamadasA(ENTREGAR).length).toBe(1))
  })
  it('después de No pude entregar: "Listo, avisamos a Ventas" y Volver al viaje', async () => {
    pintar(hoja(P1))
    await userEvent.press(await screen.findByLabelText('¡Llegué!'))
    await userEvent.press(await screen.findByLabelText('No pude entregar'))
    await userEvent.press(await screen.findByLabelText('Dirección incorrecta'))
    await userEvent.press(screen.getByLabelText('Avisar a Ventas'))
    expect(await screen.findByText('Listo, avisamos a Ventas')).toBeTruthy()
    expect(screen.getByText('Lo reprograman. Seguís con la próxima parada.')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Volver al viaje'))
    await waitFor(() => expect(screen.queryByText('Listo, avisamos a Ventas')).toBeNull())
  })
})

describe.each(['light', 'dark'] as const)('No di vuelto (%s)', (tema) => {
  beforeEach(() => conTema(tema))
  const conVuelto = async (monto = '600', dio = '1000') => {
    pintar(hoja(P1_CONTADO))
    await abrir()
    await hastaElCobro()
    await sumarPago('Efectivo', monto)
    await userEvent.press(screen.getByLabelText('Te dio'))
    await userEvent.type(screen.getByLabelText('Te dio (cobro 1)'), dio)
  }
  const confirmar = async () => {
    await aConfirmar()
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
  }
  const AVISO = /de más quedan en su cuenta corriente/

  it('con vuelto por dar muestra "Su vuelto" y la opción, sin avisar nada de la cuenta', async () => {
    await conVuelto()
    expect(screen.getByText('Su vuelto $ 400,00')).toBeTruthy()
    expect(screen.getByLabelText('No di vuelto')).toBeTruthy()
    expect(screen.getByLabelText('Di el vuelto').props.accessibilityState.selected).toBe(true)
    expect(screen.queryByText(AVISO)).toBeNull()
  })
  it('"No di vuelto" manda lo recibido, lo dice en pantalla y el resumen muestra ese monto', async () => {
    await conVuelto()
    await userEvent.press(screen.getByLabelText('No di vuelto'))
    expect(screen.getByText('Su vuelto $ 400,00')).toBeTruthy()
    expect(screen.getByText('Los $ 400,00 de más quedan en su cuenta corriente.')).toBeTruthy()
    await aConfirmar()
    await userEvent.press(confirmarBtn())
    expect(await screen.findByText(/cobrado \$ 1\.000,00/)).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Revisar'))
    await confirmarEntrega()
    await waitFor(() => expect(llamadasA(ENTREGAR)).toHaveLength(1))
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 1000 }] })
    expect(JSON.stringify(cuerpoEntrega())).not.toMatch(/recibido|vuelto/i)
  })
  it('"Di el vuelto" deshace la elección: viaja solo el monto y desaparece el aviso', async () => {
    await conVuelto()
    await userEvent.press(screen.getByLabelText('No di vuelto'))
    await userEvent.press(screen.getByLabelText('Di el vuelto'))
    expect(screen.queryByText(AVISO)).toBeNull()
    await confirmar()
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 600 }] })
  })
  it('sin elegir nada viaja solo el monto, como siempre', async () => {
    await conVuelto()
    await confirmar()
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 600 }] })
  })
  it('si lo recibido deja de superar el monto la elección no suma nada', async () => {
    await conVuelto()
    await userEvent.press(screen.getByLabelText('No di vuelto'))
    await userEvent.clear(screen.getByLabelText('Te dio (cobro 1)'))
    await userEvent.type(screen.getByLabelText('Te dio (cobro 1)'), '600')
    expect(screen.queryByLabelText('No di vuelto')).toBeNull()
    await confirmar()
    expect(cuerpoEntrega().cobro).toEqual({ imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 600 }] })
  })
  it('sin vuelto (justo) o en otro medio no hay opción', async () => {
    await conVuelto('600', '600')
    expect(screen.queryByLabelText('No di vuelto')).toBeNull()
    await userEvent.press(screen.getByLabelText('Justo'))
    expect(screen.queryByLabelText('No di vuelto')).toBeNull()
    await userEvent.press(screen.getByLabelText('Quitar cobro 1'))
    await userEvent.press(screen.getByLabelText('Transferencia'))
    await userEvent.type(screen.getByLabelText('Monto del cobro 1'), '600')
    expect(screen.queryByLabelText('No di vuelto')).toBeNull()
    expect(screen.queryByLabelText('Te dio')).toBeNull()
  })
})
