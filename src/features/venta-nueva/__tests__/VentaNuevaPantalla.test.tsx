import React from 'react'
import { Alert } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { avisosVenta } from '../lib/avisos'

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  Redirect: ({ href }: { href: string }) => mockBoton(`redirige a ${href}`, jest.fn()),
}))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
// La hoja de cliente y el catálogo tienen sus tests: acá solo se elige y se agrega.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('@/features/clientes/components/SeleccionarClienteSheet', () => ({
  SeleccionarClienteSheet: ({ onSelect }: { onSelect: (c: object, t: string) => void }) =>
    mockBoton('Elegir Tarantino', () => onSelect({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }, 'Pedido')),
}))
jest.mock('../components/CatalogoVenta', () => ({
  CatalogoVenta: () => mockBoton('Añadir pala', () =>
    require('../hooks/useCarritoVenta').useCarritoVenta.getState().agregar(require('../__testing__/producto').producto())),
}))

const { ApiError } = jest.requireActual('@/core/api/client')

function pantalla() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla /></QueryClientProvider>)
}
const sync = () => screen.getByText(/Guardado|Guardando…|Sin guardar|Creando borrador…|Sin autoguardado/)
async function elegirCliente() {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
}
async function anadir() {
  if (!screen.queryByRole('button', { name: 'Añadir pala' })) await userEvent.press(screen.getByRole('button', { name: 'Agregar productos' }))
  await userEvent.press(screen.getByRole('button', { name: 'Añadir pala' }))
}
const ESPERA = { timeout: 3000 }

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
  mockPut.mockReset().mockImplementation((_u: string, body: { version: number }) => Promise.resolve({ ventaId: 'b1', version: body.version + 1, message: 'ok' }))
  mockBack.mockReset()
  mockGet.mockReset().mockResolvedValue(undefined)
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useCarritoVenta.setState({ lineas: [] })
})

describe('venta nueva: cliente, borrador y autoguardado', () => {
  it('al elegir el cliente crea el borrador para ese cliente y lo nombra por la dirección', async () => {
    await elegirCliente()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID })
    expect(screen.getByText('Nuevo pedido')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('autoguarda las líneas con la versión del borrador y encadena la que devuelve el servidor', async () => {
    await elegirCliente()
    await anadir()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    const items = [{ productoId: 'p1', cantidad: 1, descuentoPorcentaje: 0 }]
    expect(mockPut).toHaveBeenLastCalledWith('/api/v1/Ventas/b1', { id: 'b1', version: 7, descuentoGeneral: 0, metodoEntrega: 1, items, fechaEntrega: expect.any(String), cargoFlete: 0 })
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    await anadir()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2), ESPERA)
    expect(mockPut.mock.calls[1][1]).toMatchObject({ version: 8, items: [{ productoId: 'p1', cantidad: 2 }] })
  })

  it('si el servidor rechaza el guardado, se ve su motivo', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'No se pudo guardar.', ['El descuento supera tu tope.']))
    await elegirCliente()
    await anadir()
    expect(await screen.findByText(/El descuento supera tu tope\./, {}, ESPERA)).toBeTruthy()
    expect(sync()).toHaveTextContent('Sin guardar')
  })

  it('con un 409 (cambiado en otro lado) deja de guardar y lo avisa', async () => {
    mockPut.mockRejectedValue(new ApiError(409, 'Conflicto'))
    await elegirCliente()
    await anadir()
    expect(await screen.findByText(/se cambió desde otro lado/, {}, ESPERA)).toBeTruthy()
    await anadir()
    await new Promise((r) => setTimeout(r, 1000))
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('si no se puede crear el borrador, se sigue armando la venta y se avisa', async () => {
    mockPost.mockRejectedValue(new ApiError(404, 'Cliente no encontrado o no es de tipo Cliente.'))
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    expect(await screen.findByText(/Cliente no encontrado.*no se guarda sola/s)).toBeTruthy()
    expect(sync()).toHaveTextContent('Sin autoguardado')
    expect(screen.getByRole('button', { name: 'Agregar productos' })).toBeTruthy()
  })

  it('descartar borra el borrador en el servidor y vuelve', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => { void botones?.[1]?.onPress?.() })
    await elegirCliente()
    mockPost.mockResolvedValue(true)
    await userEvent.press(screen.getByRole('button', { name: 'Descartar borrador' }))
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Ventas/b1/descartar-borrador')
  })
})

describe('pestaña Líneas', () => {
  const pala = producto({ real: 100 })
  const conLineas = (descuentoPct = 0, cantidad = 12, p = pala) => useCarritoVenta.setState({ lineas: [{ productoId: p.id, producto: p, cantidad, descuentoPct }] })
  beforeEach(() => useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never }))

  it('una línea sobre el tope lo marca y avisa que el pedido va a quedar por autorizar', async () => {
    await elegirCliente()
    conLineas(12.82)
    expect(await screen.findByText('Desc. 12,82 % · sobre tu tope')).toBeTruthy()
    expect(screen.getByText('Este pedido va a quedar por autorizar')).toBeTruthy()
    expect(screen.getByText(/Porque un descuento supera tu tope/)).toBeTruthy()
  })

  it('sin stock suficiente también avisa; dentro del tope y con stock, no hay banner', async () => {
    await elegirCliente()
    conLineas(5, 12)
    expect(await screen.findByText('Desc. 5 %')).toBeTruthy()
    expect(screen.queryByText('Este pedido va a quedar por autorizar')).toBeNull()
    conLineas(5, 120)
    expect(await screen.findByText(/Porque falta stock/)).toBeTruthy()
  })

  it('el descuento general viaja en el autoguardado y baja el total estimado', async () => {
    await elegirCliente()
    conLineas(0, 10)
    const campo = screen.getByLabelText('Descuento general (%)')
    await userEvent.clear(campo)
    await userEvent.type(campo, '10')
    await waitFor(() => expect(mockPut).toHaveBeenLastCalledWith('/api/v1/Ventas/b1', expect.objectContaining({ descuentoGeneral: 10 })), ESPERA)
    expect(screen.getByTestId('venta-total')).toHaveTextContent('$ 22.464,00') // 10 × 2.496 − 10 %
  })

  it('muestra la comisión estimada que calcula el servidor, solo con comisión activa', async () => {
    mockPost.mockImplementation((url: string) => Promise.resolve(url.includes('simulacion')
      ? { comisionActiva: true, montoCobro: 29952, montoComision: 2567.5, porcentajePonderado: 5, esMixta: false, lineas: [] }
      : { ventaId: 'b1', version: 7, message: '' }))
    await elegirCliente()
    conLineas()
    expect(await screen.findByText('Tu comisión estimada $ 2.567,50', {}, ESPERA)).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/comisiones/simulacion', { lineas: [{ productoId: 'p1', subtotal: 29952 }], descuentoGeneral: 0, cargoFlete: 0 })
  })

  it('avisos: un presupuesto sobre el tope se rechaza (no va a autorización) y el piso suma el descuento general', () => {
    const lineas = [{ productoId: 'p1', producto: pala, cantidad: 1, descuentoPct: 15 }]
    const presupuesto = avisosVenta(lineas, { tipo: 'Presupuesto', tope: 10, exento: false, descuentoGeneral: 0 })
    expect(presupuesto.porAutorizar).toEqual([])
    expect(presupuesto.rechazos).toEqual([expect.stringMatching(/presupuesto no admite/)])
    // 2496 con 15 % + 10 % general = 1909,44 < mínimo 2000 → debajo del mínimo; con 15 % solo, no.
    expect(avisosVenta(lineas, { tipo: 'Pedido', tope: 50, exento: false, descuentoGeneral: 0 }).porAutorizar).toEqual([])
    expect(avisosVenta(lineas, { tipo: 'Pedido', tope: 50, exento: false, descuentoGeneral: 10 }).porAutorizar).toEqual(['un precio queda debajo del mínimo'])
  })
})

describe('pestaña Cabecera', () => {
  const ultimoPut = () => mockPut.mock.calls[mockPut.mock.calls.length - 1][1]
  async function enCabecera() {
    await elegirCliente()
    useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: producto({ real: 100 }), cantidad: 10, descuentoPct: 0 }] })
    await userEvent.press(screen.getByRole('tab', { name: 'Cabecera' }))
  }

  it('retiro: sin fecha ni flete en el autoguardado y sin tira de días', async () => {
    await enCabecera()
    await userEvent.press(screen.getByRole('radio', { name: 'Retiro' }))
    await waitFor(() => expect(ultimoPut()).toMatchObject({ metodoEntrega: 2 }), ESPERA)
    expect(ultimoPut()).not.toHaveProperty('fechaEntrega')
    expect(ultimoPut()).not.toHaveProperty('cargoFlete')
    expect(screen.queryByText('Fecha de entrega')).toBeNull()
    expect(screen.getByText('Retira en el local: sin flete.')).toBeTruthy()
  })

  it('la tira tacha los días sin entrega y los feriados del servidor; propone el próximo hábil', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T15:00:00Z')) // miércoles 7 en Argentina
    mockGet.mockImplementation((url: string) => Promise.resolve(
      url.includes('dias-entrega') ? { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: false }
        : url.includes('feriados') ? [{ fecha: '2026-10-12', descripcion: 'Día de la Diversidad' }] : undefined))
    await enCabecera()
    expect(await screen.findByLabelText('lun 12, sin entregas (Día de la Diversidad)')).toBeDisabled()
    expect(screen.getByLabelText('dom 11, sin entregas')).toBeDisabled()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Configuracion/feriados?desde=2026-10-07')
    await waitFor(() => expect(ultimoPut()).toMatchObject({ fechaEntrega: '2026-10-08' }), ESPERA)
    await userEvent.press(screen.getByLabelText('vie 9'))
    await waitFor(() => expect(ultimoPut()).toMatchObject({ fechaEntrega: '2026-10-09' }), ESPERA)
    jest.restoreAllMocks()
  })

  it('flete y observaciones viajan en el autoguardado; el flete suma al total; la condición de pago se ve', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(url.includes('socios-comerciales') ? { condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 } } : undefined))
    await enCabecera()
    expect(await screen.findByText('Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Flete ($)'), '3300')
    await userEvent.type(screen.getByLabelText('Observaciones'), ' Por la puerta de atrás ')
    await waitFor(() => expect(ultimoPut()).toMatchObject({ cargoFlete: 3300, observaciones: 'Por la puerta de atrás' }), ESPERA)
    expect(screen.getByTestId('venta-total')).toHaveTextContent('$ 28.260,00') // 10 × 2.496 + 3.300
  })

  it('cesión: valida el rango, avisa que va a autorización y no viaja en el autoguardado del borrador', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10, comisionActiva: true, porcentajeComision: 5 } as never })
    await enCabecera()
    const campo = screen.getByLabelText('Ceder parte de mi comisión (%)')
    await userEvent.type(campo, '1')
    expect(screen.getByText('Podés ceder desde 2,5 % hasta menos de 5 %.')).toBeTruthy()
    await userEvent.clear(campo)
    await userEvent.type(campo, '3')
    await userEvent.press(screen.getByRole('tab', { name: 'Líneas (1)' }))
    expect(screen.getByText(/cediste parte de tu comisión/)).toBeTruthy()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(ultimoPut()).not.toHaveProperty('porcentajeComisionCedido')
  })

  it('tablet horizontal: Líneas y Cabecera lado a lado, sin pestañas', async () => {
    mockDims.mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 })
    await elegirCliente()
    expect(screen.queryByRole('tab', { name: 'Cabecera' })).toBeNull()
    expect(screen.getByText('Agregar productos')).toBeTruthy()
    expect(screen.getByText('Fecha de entrega')).toBeTruthy()
  })
})

describe('ruta ventas/nueva-v2', () => {
  const Ruta = require('../../../../app/(tabs)/ventas/nueva-v2').default
  it('con el switch apagado lleva a la venta de hoy', () => {
    useAuthStore.setState({ user: { id: 'u', username: 'u', roles: ['Administrador'] as never, permissions: [] } })
    useVentaNuevaStore.setState({ activa: false })
    render(<Ruta />)
    expect(screen.getByText('redirige a /(tabs)/ventas/nueva')).toBeTruthy()
  })
})
