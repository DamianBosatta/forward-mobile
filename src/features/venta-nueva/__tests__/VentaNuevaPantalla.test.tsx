import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { avisosVenta } from '../lib/avisos'
import { aplicarDescuentoGeneral } from '../__testing__/descuentoGeneral'

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
const mockReplace = jest.fn()
let mockTipo = 'Pedido'
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => mockBoton(`redirige a ${href}`, jest.fn()),
}))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
// La lista de clientes y el catálogo tienen sus tests: acá solo se elige y se agrega.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('../components/ElegirClienteVenta', () => ({
  ElegirClienteVenta: ({ onElegir }: { onElegir: (c: object) => void }) =>
    mockBoton('Elegir Tarantino', () => onElegir({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' })),
}))
jest.mock('../components/CatalogoVenta', () => ({
  CatalogoVenta: ({ onVerVenta }: { onVerVenta: () => void }) => (
    <>
      {mockBoton('Añadir pala', () => require('../hooks/useCarritoVenta').useCarritoVenta.getState().agregar(require('../__testing__/producto').producto()))}
      {mockBoton('Ver venta', onVerVenta)}
    </>
  ),
}))

const { ApiError } = jest.requireActual('@/core/api/client')

let qc: QueryClient
function pantalla(props: React.ComponentProps<typeof VentaNuevaPantalla> = {}) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla {...props} /></QueryClientProvider>)
}
const sync = () => screen.getByText(/Guardado|Guardando…|Sin guardar|Creando borrador…|Sin autoguardado/)
// V2 elegir cliente y V3 cómo arrancar (con el tipo que se elige ahí); arrancar crea el borrador y abre el catálogo.
async function arrancar(como = 'Buscar en el catálogo') {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  if (mockTipo === 'Presupuesto') await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
  await userEvent.press(screen.getByRole('button', { name: como }))
}
async function elegirCliente() {
  await arrancar()
  // Se cierra el catálogo para quedar en la venta (V6).
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
}
// V6 "Seguir" abre V7 Confirmar; ahí está el botón que guarda.
const abrirConfirmacion = () => userEvent.press(screen.getByRole('button', { name: 'Seguir' }))
async function seguirYPresionar(nombre: string) {
  await abrirConfirmacion()
  await userEvent.press(screen.getByRole('button', { name: nombre }))
}
async function anadir() {
  if (!screen.queryByRole('button', { name: 'Añadir pala' })) await userEvent.press(screen.getByRole('button', { name: 'Agregar productos' }))
  await userEvent.press(screen.getByRole('button', { name: 'Añadir pala' }))
}
const ESPERA = { timeout: 3000 }
// Calendario de entregas del servidor: todos los días hábiles y sin feriados.
const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const calendario = (url: string) => url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : undefined

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
  mockPut.mockReset().mockImplementation((_u: string, body: { version: number }) => Promise.resolve({ ventaId: 'b1', version: body.version + 1, message: 'ok' }))
  mockBack.mockReset()
  mockReplace.mockReset()
  mockTipo = 'Pedido'
  mockGet.mockReset().mockImplementation((url: string) => Promise.resolve(calendario(url)))
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useCarritoVenta.setState({ lineas: [] })
})

describe('venta nueva: cliente, borrador y autoguardado', () => {
  it('al elegir el cliente crea el borrador para ese cliente, lo nombra por la dirección y le guarda la fecha propuesta', async () => {
    await elegirCliente()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Pedido' })
    expect(screen.getByText('Nuevo pedido')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    // El borrador nace vacío en el servidor: la fecha propuesta viaja en el primer autoguardado.
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    expect(mockPut.mock.calls[0][1]).toMatchObject({ items: [], fechaEntrega: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
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

  it('lo que se carga mientras se crea el borrador se autoguarda cuando el borrador nace', async () => {
    let nacer: (r: object) => void = () => undefined
    mockPost.mockImplementationOnce(() => new Promise((r) => { nacer = r }))
    await arrancar()
    expect(sync()).toHaveTextContent('Creando borrador…')
    await anadir()
    await act(async () => nacer({ ventaId: 'b1', version: 7, message: 'Borrador creado.' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    expect(mockPut.mock.calls[0][1]).toMatchObject({ id: 'b1', version: 7, items: [{ productoId: 'p1', cantidad: 1, descuentoPorcentaje: 0 }] })
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
    await arrancar()
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

  // Servidor con forward-system #883: el borrador recién creado vuelve en /borradores/mios con su tipo.
  const servidorNuevo = (tipoOperacion?: string) => mockGet.mockImplementation((url: string) =>
    Promise.resolve(url === '/api/v1/Ventas/borradores/mios' ? [{ id: 'b1', version: 7, tipoOperacion }] : calendario(url)))

  it('el borrador nace con el tipo que se eligió: Presupuesto también viaja', async () => {
    mockTipo = 'Presupuesto'
    await elegirCliente()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Presupuesto' })
  })

  it('servidor nuevo: el autoguardado de un pedido manda el descuento sobre el tope sin recortarlo', async () => {
    servidorNuevo('Pedido')
    await elegirCliente()
    // El id del POST es el que se busca en /mios (si no coincidiera, el servidor nuevo pasaría por viejo).
    expect(await mockPost.mock.results[0].value).toMatchObject({ ventaId: 'b1' })
    conLineas(12.82)
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(mockPut.mock.calls.at(-1)[1].items).toEqual([{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 12.82 }])
    expect(screen.queryByText(/el resto se guarda al confirmar el pedido/)).toBeNull()
  })

  it.each([
    ['servidor viejo: el borrador no trae el tipo', () => mockGet.mockImplementation((url: string) =>
      Promise.resolve(url === '/api/v1/Ventas/borradores/mios' ? [{ id: 'b1', version: 7 }] : calendario(url)))],
    ['/mios no trae el borrador', () => mockGet.mockImplementation((url: string) =>
      Promise.resolve(url === '/api/v1/Ventas/borradores/mios' ? [{ id: 'otro', version: 1, tipoOperacion: 'Pedido' }] : calendario(url)))],
    ['no se puede saber (el GET falla)', () => mockGet.mockImplementation((url: string) =>
      url === '/api/v1/Ventas/borradores/mios' ? Promise.reject(new Error('sin señal')) : Promise.resolve(calendario(url)))],
  ])('%s: se sigue recortando al tope', async (_nombre, preparar) => {
    preparar()
    await elegirCliente()
    conLineas(12.82)
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(mockPut.mock.calls.at(-1)[1].items).toEqual([{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 10 }])
  })

  it('si el GET de /mios falla una vez, se reintenta una vez en el siguiente cambio y deja de recortar', async () => {
    let llamadas = 0
    mockGet.mockImplementation((url: string) => {
      if (url !== '/api/v1/Ventas/borradores/mios') return Promise.resolve(calendario(url))
      return ++llamadas === 1 ? Promise.reject(new Error('sin señal')) : Promise.resolve([{ id: 'b1', version: 7, tipoOperacion: 'Pedido' }])
    })
    await elegirCliente()
    // El primer cambio después del fallo dispara el reintento (uno solo) y el descuento ya viaja completo.
    conLineas(12.82)
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1].items).toEqual([{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 12.82 }]), ESPERA)
    conLineas(12.82, 13)
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1].items).toEqual([{ productoId: 'p1', cantidad: 13, descuentoPorcentaje: 12.82 }]), ESPERA)
    expect(llamadas).toBe(2)
  })

  it('pedido sobre el tope: el borrador (Presupuesto en el servidor) guarda hasta el tope y el descuento elegido viaja al confirmar', async () => {
    await elegirCliente()
    conLineas(12.82)
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(mockPut.mock.calls.at(-1)[1].items).toEqual([{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 10 }])
    expect(await screen.findByText(/el resto se guarda al confirmar el pedido/)).toBeTruthy()
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    await seguirYPresionar('Confirmar pedido')
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.objectContaining({
      tipoOperacion: 2, items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 12.82 }],
    })))
  })

  const EXENTO = { module: 'CAP_EXENTO_TOPE_DESCUENTO', canRead: true }
  // El borrador de un Pedido guarda cada descuento hasta el tope del perfil (también el de quien está exento,
  // como VendedorDiscountCapPolicy); con tope 0 o un Presupuesto, viaja tal cual.
  it.each([
    ['exento CON tope de perfil: el borrador respeta el tope', 'Pedido', [EXENTO], 10, [12.82], 0, [10], 0],
    ['exento SIN perfil (tope 0): nada se acota', 'Pedido', [EXENTO], 0, [12.82], 0, [12.82], 0],
    ['no exento con tope: se acota', 'Pedido', [], 10, [12.82], 0, [10], 0],
    ['tope 0: nada se acota', 'Pedido', [], 0, [12.82], 0, [12.82], 0],
    ['tope sin definir: nada se acota', 'Pedido', [], undefined, [12.82], 0, [12.82], 0],
    ['descuento general sobre el tope: se acota', 'Pedido', [], 10, [5], 15, [5], 10],
    ['Presupuesto: no se acota', 'Presupuesto', [], 10, [12.82], 15, [12.82], 15],
    ['líneas mezcladas: solo se acotan las que pasan el tope', 'Pedido', [], 10, [5, 12.82], 0, [5, 10], 0],
  ] as const)('borrador: %s', async (_nombre, tipo, permissions, maxDescuentoPorcentaje, descuentos, general, items, descuentoGeneral) => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions, maxDescuentoPorcentaje } as never })
    mockTipo = tipo
    const otra = producto({ id: 'p2', real: 100 })
    await elegirCliente()
    useCarritoVenta.setState({ lineas: descuentos.map((descuentoPct, i) => ({ productoId: i ? 'p2' : 'p1', producto: i ? otra : pala, cantidad: 12, descuentoPct })) })
    if (general) await aplicarDescuentoGeneral(general)
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
      descuentoGeneral,
      items: items.map((d, i) => ({ productoId: i ? 'p2' : 'p1', cantidad: 12, descuentoPorcentaje: d })),
    })), ESPERA)
  })

  it('el banner dice los motivos del servidor (deuda vencida y tope de crédito incluidos) antes de guardar', async () => {
    const original = mockPost.getMockImplementation()
    mockPost.mockImplementation((url: string, body: unknown) => url === '/api/v1/Ventas/vista-previa'
      ? Promise.resolve({ requiereAutorizacion: true, estadoResultante: 'PendienteAutorizacion', motivoPendienteAutorizacion: 48,
        motivos: ['cliente con deuda de más de 30 días', 'supera el tope de venta del cliente'], rechazos: [], productosSinStock: [], total: 100, lineas: [] })
      : original!(url, body))
    await elegirCliente()
    conLineas(5, 12)
    expect(await screen.findByText(/Porque cliente con deuda de más de 30 días, supera el tope de venta del cliente/, {}, ESPERA)).toBeTruthy()
    const pedido = mockPost.mock.calls.find(([u]) => u === '/api/v1/Ventas/vista-previa')![1]
    expect(pedido).toMatchObject({ clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 5 }] })
  })

  it('un rechazo del servidor se muestra antes de guardar', async () => {
    const original = mockPost.getMockImplementation()
    mockPost.mockImplementation((url: string, body: unknown) => url === '/api/v1/Ventas/vista-previa'
      ? Promise.resolve({ requiereAutorizacion: false, estadoResultante: null, motivos: [], productosSinStock: [], total: null, lineas: [],
        rechazos: ['No se puede crear la venta: el precio de los siguientes productos es inferior al costo directo (piso absoluto): Pala.'] })
      : original!(url, body))
    await elegirCliente()
    conLineas(5, 12)
    expect(await screen.findByText(/inferior al costo directo \(piso absoluto\): Pala\./, {}, ESPERA)).toBeTruthy()
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
    await aplicarDescuentoGeneral(10)
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

  it('sin calendario de entregas no propone fecha (ni la autoguarda), lo avisa y Reintentar lo vuelve a traer', async () => {
    mockGet.mockImplementation((url: string) => url.includes('dias-entrega') ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve(calendario(url)))
    await enCabecera()
    expect(await screen.findByText('No se pudo traer el calendario de entregas.')).toBeTruthy()
    expect(screen.getByText('Sin fecha: elegí el día de entrega.')).toBeTruthy()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(ultimoPut()).not.toHaveProperty('fechaEntrega')
    mockGet.mockImplementation((url: string) => Promise.resolve(calendario(url)))
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(ultimoPut()).toMatchObject({ fechaEntrega: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }), ESPERA)
    expect(screen.queryByText('No se pudo traer el calendario de entregas.')).toBeNull()
  })

  it('con el calendario todavía cargando no se autoguarda una fecha', async () => {
    mockGet.mockImplementation((url: string) => url.includes('dias-entrega') ? new Promise(() => undefined) : Promise.resolve(calendario(url)))
    await enCabecera()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(ultimoPut()).not.toHaveProperty('fechaEntrega')
  })

  it('flete y observaciones viajan en el autoguardado; el flete suma al total; la condición de pago se ve', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(url.includes('socios-comerciales') ? { condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 } } : calendario(url)))
    await enCabecera()
    expect(await screen.findByText('Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Flete ($)'), '3300')
    await userEvent.type(screen.getByLabelText('Observaciones'), ' Por la puerta de atrás ')
    await waitFor(() => expect(ultimoPut()).toMatchObject({ cargoFlete: 3300, observaciones: 'Por la puerta de atrás' }), ESPERA)
    expect(screen.getByTestId('venta-total')).toHaveTextContent('$ 28.260,00') // 10 × 2.496 + 3.300
  })

  describe('crédito disponible del cliente', () => {
    const conSocio = (socio: unknown) => mockGet.mockImplementation((url: string) =>
      url.includes('socios-comerciales') ? socio instanceof Error ? Promise.reject(socio) : Promise.resolve(socio) : Promise.resolve(calendario(url)))

    it('lo muestra de la ficha del cliente cuando el servidor deja ver importes', async () => {
      conSocio({ condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 }, puedeVerSaldo: true, creditoDisponible: 125000 })
      await enCabecera()
      expect(await screen.findByLabelText('Crédito disponible: $ 125.000,00')).toBeTruthy()
    })

    it('pasado del tope: lo dice con el importe que se pasó', async () => {
      conSocio({ puedeVerSaldo: true, creditoDisponible: -4500 })
      await enCabecera()
      expect(await screen.findByLabelText('Crédito disponible: Pasado del tope por $ 4.500,00')).toBeTruthy()
    })

    it.each([
      ['redactado por el servidor (puedeVerSaldo false, llega en 0)', { puedeVerSaldo: false, creditoDisponible: 0 }],
      ['sin tope (null)', { puedeVerSaldo: true, creditoDisponible: null }],
      ['de un servidor anterior (sin el campo)', { puedeVerSaldo: true }],
      ['de un servidor que ni manda puedeVerSaldo', { creditoDisponible: 80000 }],
    ])('no lo muestra si está %s', async (_caso, socio) => {
      conSocio({ condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 }, ...socio })
      await enCabecera()
      expect(await screen.findByText('Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
      expect(screen.queryByText('Crédito disponible')).toBeNull()
    })

    it('si la ficha falla no muestra nada y la cabecera sigue usable', async () => {
      conSocio(new TypeError('Network request failed'))
      await enCabecera()
      expect(await screen.findByText('Fecha de entrega')).toBeTruthy()
      expect(screen.queryByText('Crédito disponible')).toBeNull()
      expect(screen.getByLabelText('Flete ($)')).toBeTruthy()
      await waitFor(() => expect(ultimoPut()).toMatchObject({ fechaEntrega: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }), ESPERA)
    })
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

describe('confirmar', () => {
  const pala = producto({ real: 100 })
  const altas = () => mockPost.mock.calls.filter(([u]) => u === '/api/v1/Ventas')
  let alerta: jest.SpyInstance
  beforeEach(() => {
    alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas'
      ? { ventaId: 'v9', version: 1, message: 'Pedido creado y confirmado exitosamente. Stock reservado.' }
      : url.endsWith('descartar-borrador') ? true : { ventaId: 'b1', version: 7, message: '' }))
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/v9' ? { venta: { estado: 2 }, detalles: [] } : calendario(url)))
  })
  afterEach(() => alerta.mockRestore())
  async function armar(cantidad = 12) {
    await elegirCliente()
    useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: pala, cantidad, descuentoPct: 0 }] })
    await screen.findByText('Pala c/Cabo Fija LP')
  }
  const confirmar = () => seguirYPresionar('Confirmar pedido')
  const guardada = (id: string, mensaje: string) => ({ pathname: '/(tabs)/ventas/guardada', params: { id, mensaje } })
  // La vista previa de la venta también hace POST: las respuestas de prueba se encolan solo para el
  // alta (`/api/v1/Ventas`), así una vista previa nunca se queda con la respuesta que era del alta.
  const alAlta = (...respuestas: Array<() => Promise<unknown>>) => {
    const antes = mockPost.getMockImplementation()
    mockPost.mockImplementation((url: string, ...resto: unknown[]) =>
      url === '/api/v1/Ventas' && respuestas.length > 0 ? respuestas.shift()!() : antes?.(url, ...resto))
  }

  it('pedido: manda el alta como CreateVentaCommand con clave de idempotencia, descarta el borrador y va a la venta guardada', async () => {
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Pedido creado y confirmado exitosamente. Stock reservado.')))
    expect(altas()[0][1]).toEqual({
      clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 2, descuentoGeneral: 0, metodoEntrega: 1, entregaInmediata: false,
      items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 0 }], fechaEntrega: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      claveIdempotencia: expect.stringMatching(/^mobile-/),
    })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/b1/descartar-borrador')
  })

  it('un reintento tras un corte reusa la misma clave de idempotencia (no duplica el pedido)', async () => {
    await armar()
    alAlta(() => Promise.reject(new TypeError('Network request failed')))
    await confirmar()
    expect(await screen.findByText('Network request failed')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(altas()).toHaveLength(2)
    expect(altas()[1][1].claveIdempotencia).toBe(altas()[0][1].claveIdempotencia)
  })

  const REPETIDA = 'La venta ya había sido creada con esta clave de idempotencia (operación repetida).'
  // Tras un corte la clave se reusa siempre: un pedido duplicado es peor que perder ediciones.
  const cortarYReintentar = async (editar: boolean, mensaje: string, corte: unknown = new TypeError('Network request failed'), textoCorte = 'Network request failed') => {
    await armar()
    alAlta(() => Promise.reject(corte), () => Promise.resolve({ ventaId: 'v9', version: 1, message: mensaje }))
    await confirmar()
    expect(await screen.findByText(textoCorte)).toBeTruthy()
    if (editar) act(() => useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: pala, cantidad: 13, descuentoPct: 0 }] }))
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(altas()).toHaveLength(2)
    expect(altas()[1][1].claveIdempotencia).toBe(altas()[0][1].claveIdempotencia)
  }

  it('servidor viejo (200 «ya había sido creada»): si tras el corte se cambió el pedido y ya se había grabado, avisa y lleva a esa venta para revisarla', async () => {
    await cortarYReintentar(true, REPETIDA)
    expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'El pedido ya se había grabado con lo de antes. Revisalo y editalo si cambiaste algo.'))
  })

  it('un 504 del gateway cuenta como sin respuesta: si el pedido ya se había grabado, avisa', async () => {
    await cortarYReintentar(true, REPETIDA, new ApiError(504, 'Gateway Timeout'), 'Gateway Timeout')
    expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'El pedido ya se había grabado con lo de antes. Revisalo y editalo si cambiaste algo.'))
  })

  const YA_GRABADO = 'El pedido ya estaba grabado.'
  it('si tras el corte el pedido no cambió, el reintento va a la venta con un mensaje claro (sin el texto técnico)', async () => {
    await cortarYReintentar(false, REPETIDA)
    expect(mockReplace).toHaveBeenCalledWith(guardada('v9', YA_GRABADO))
  })

  it('si tras el corte se cambió el pedido pero el primer intento no se había grabado, se guarda con las ediciones sin aviso', async () => {
    await cortarYReintentar(true, 'Pedido creado y confirmado exitosamente. Stock reservado.')
    expect(altas()[1][1].items).toEqual([{ productoId: 'p1', cantidad: 13, descuentoPorcentaje: 0 }])
    expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Pedido creado y confirmado exitosamente. Stock reservado.'))
  })

  // Servidor nuevo (forward-system #867): la clave ya usada con otro cuerpo es un 409 con código y la venta grabada.
  const CON_LO_DE_ANTES = 'El pedido ya se había grabado con lo de antes. Revisalo y editalo si cambiaste algo.'
  const otroCuerpo = () => Object.assign(
    new ApiError(409, 'Esta clave de idempotencia ya se usó para grabar otro pedido (distinto cliente, tipo, líneas, cantidades o descuentos).'),
    { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: { ventaId: 'v9', version: 3, message: 'x' } })

  it('servidor nuevo: si tras el corte se cambió el pedido, el 409 con la venta grabada lleva a ella con el aviso y descarta el borrador', async () => {
    await armar()
    alAlta(() => Promise.reject(new TypeError('Network request failed')), () => Promise.reject(otroCuerpo()))
    await confirmar()
    expect(await screen.findByText('Network request failed')).toBeTruthy()
    act(() => useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: pala, cantidad: 13, descuentoPct: 0 }] }))
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', CON_LO_DE_ANTES)))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(altas()[1][1].claveIdempotencia).toBe(altas()[0][1].claveIdempotencia)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/b1/descartar-borrador')
    expect(screen.queryByText(/clave de idempotencia/)).toBeNull()
    expect(useCarritoVenta.getState().lineas).toEqual([])
  })

  it('un 409 con el código Duplicado (la clave ya se estaba grabando) no cambia la clave: avisa y el reintento la reusa', async () => {
    await armar()
    alAlta(() => Promise.reject(new ApiError(409, 'Ya existe un registro con datos duplicados.', undefined, 'Duplicado')))
    await confirmar()
    expect(await screen.findByText(/Este pedido ya se estaba grabando/)).toBeTruthy()
    expect(screen.queryByText(/datos duplicados/)).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Ventas/b1/descartar-borrador')
    alAlta(() => Promise.resolve({ ventaId: 'v9', version: 1, message: REPETIDA }))
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', YA_GRABADO)))
    expect(altas()[1][1].claveIdempotencia).toBe(altas()[0][1].claveIdempotencia)
  })

  it('otro 409 (clave foránea, concurrencia) muestra el mensaje del servidor, no el de la clave en curso, aunque el texto diga «duplicados»', async () => {
    await armar()
    alAlta(() => Promise.reject(new ApiError(409, 'Operación bloqueada por restricciones de integridad (clave foránea).')))
    await confirmar()
    expect(await screen.findByText('Operación bloqueada por restricciones de integridad (clave foránea).')).toBeTruthy()
    expect(screen.queryByText(/ya se estaba grabando/)).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('un 409 con el código pero sin la venta en data muestra el mensaje del servidor', async () => {
    await armar()
    alAlta(() => Promise.reject(Object.assign(otroCuerpo(), { data: undefined })))
    await confirmar()
    expect(await screen.findByText(/Esta clave de idempotencia ya se usó/)).toBeTruthy()
    expect(screen.queryByText(/ya se estaba grabando/)).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('sin stock pide el motivo antes de mandar y lo manda en el alta', async () => {
    await armar(120)
    await confirmar()
    expect(screen.getByText('Falta stock')).toBeTruthy()
    expect(altas()).toHaveLength(0)
    await userEvent.type(screen.getByLabelText('Motivo'), 'Repone el lunes')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar con este motivo' }))
    await waitFor(() => expect(altas()).toHaveLength(1))
    expect(altas()[0][1]).toMatchObject({ motivoVentaSinStock: 'Repone el lunes' })
  })

  it('si el servidor pide justificación por stock (código VentaFaltaStockSinJustificacion), se ve su motivo y se abre el pedido de motivo', async () => {
    mockPost.mockImplementation((u: string) => u === '/api/v1/Ventas'
      ? Promise.reject(new ApiError(400, 'Stock insuficiente para los siguientes productos en el depósito seleccionado: Pala. Debe proporcionar una justificación.', undefined, 'VentaFaltaStockSinJustificacion'))
      : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))
    await armar()
    await confirmar()
    expect(await screen.findByText(/Debe proporcionar una justificación/)).toBeTruthy()
    expect(screen.getByLabelText('Motivo')).toBeTruthy()
  })

  it('un rechazo cuyo texto menciona la justificación pero trae otro código no abre el pedido de motivo', async () => {
    mockPost.mockImplementation((u: string) => u === '/api/v1/Ventas'
      ? Promise.reject(new ApiError(400, 'La justificación del descuento no es válida.', undefined, 'VentaDescuentoSuperaElTope'))
      : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))
    await armar()
    await confirmar()
    expect(await screen.findByText(/La justificación del descuento no es válida/)).toBeTruthy()
    expect(screen.queryByLabelText('Motivo')).toBeNull()
  })

  it('por autorizar: muestra los motivos que dice el servidor', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/v9' ? { venta: { estado: 9, motivoPendienteAutorizacion: 4 | 16 }, detalles: [] } : calendario(url)))
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9',
      'Quedó por autorizar porque un descuento supera tu tope, el cliente tiene deuda de más de 30 días. Te avisamos cuando lo resuelvan.')))
  })

  // Servidor nuevo (forward-system #916): el alta ya dice cómo quedó la venta (estado y motivos).
  const lecturasDeLaVenta = () => mockGet.mock.calls.filter(([u]) => u === '/api/v1/Ventas/v9')
  const altaConResultado = (resultado: object) => mockPost.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas'
    ? { ventaId: 'v9', version: 1, message: 'Pedido creado exitosamente. Pendiente de autorización.', ...resultado }
    : url.endsWith('descartar-borrador') ? true : { ventaId: 'b1', version: 7, message: '' }))

  it('servidor nuevo: el alta trae el estado y los motivos, se muestran sin pedir la venta', async () => {
    altaConResultado({ estado: 9, motivoPendienteAutorizacion: 4 | 16 })
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9',
      'Quedó por autorizar porque un descuento supera tu tope, el cliente tiene deuda de más de 30 días. Te avisamos cuando lo resuelvan.')))
    expect(lecturasDeLaVenta()).toHaveLength(0)
  })

  it('servidor nuevo: un pedido confirmado (sin motivos) tampoco pide la venta y deja el mensaje del servidor', async () => {
    altaConResultado({ estado: 2, motivoPendienteAutorizacion: null, message: 'Pedido creado y confirmado exitosamente. Stock reservado.' })
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Pedido creado y confirmado exitosamente. Stock reservado.')))
    expect(lecturasDeLaVenta()).toHaveLength(0)
  })

  it('servidor nuevo: el 409 por otro cuerpo trae el estado de la venta grabada y tampoco pide la venta', async () => {
    await armar()
    // Solo el alta recibe el rechazo: la vista previa también hace POST y no tiene que gastarlo.
    alAlta(() => Promise.reject(Object.assign(otroCuerpo(),
      { data: { ventaId: 'v9', version: 3, message: 'x', estado: 9, motivoPendienteAutorizacion: 1 } })))
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', CON_LO_DE_ANTES)))
    expect(lecturasDeLaVenta()).toHaveLength(0)
  })

  it('servidor viejo: el alta no trae el estado, se pide la venta y se leen sus motivos', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/v9' ? { venta: { estado: 9, motivoPendienteAutorizacion: 1 }, detalles: [] } : calendario(url)))
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Quedó por autorizar porque falta stock. Te avisamos cuando lo resuelvan.')))
    expect(lecturasDeLaVenta()).toHaveLength(1)
  })

  it('servidor nuevo, pero por autorizar sin motivos en la respuesta: se pide la venta para leerlos', async () => {
    altaConResultado({ estado: 9 })
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/v9' ? { venta: { estado: 9, motivoPendienteAutorizacion: 2 }, detalles: [] } : calendario(url)))
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Quedó por autorizar porque un precio queda debajo del mínimo. Te avisamos cuando lo resuelvan.')))
    expect(lecturasDeLaVenta()).toHaveLength(1)
  })

  it('servidor viejo: si pedir la venta falla, se muestra el mensaje del alta', async () => {
    mockGet.mockImplementation((url: string) => url === '/api/v1/Ventas/v9' ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve(calendario(url)))
    await armar()
    await confirmar()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(guardada('v9', 'Pedido creado y confirmado exitosamente. Stock reservado.')))
    expect(lecturasDeLaVenta()).toHaveLength(1)
  })

  it('presupuesto: el borrador ya es el presupuesto (guardar-presupuesto con la versión vigente)', async () => {
    mockTipo = 'Presupuesto'
    await armar()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    await seguirYPresionar('Guardar presupuesto')
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/b1/guardar-presupuesto', { ventaId: 'b1', version: 8 }))
    expect(altas()).toHaveLength(0)
    expect(mockReplace).toHaveBeenCalledWith(guardada('b1', ''))
  })

  it('presupuesto: si el servidor rechaza guardar-presupuesto (descuento sobre el tope) se muestra su mensaje', async () => {
    mockTipo = 'Presupuesto'
    await armar()
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    mockPost.mockImplementation((url: string) => url.endsWith('guardar-presupuesto')
      ? Promise.reject(new ApiError(400, 'Un presupuesto no admite descuentos sobre tu tope.'))
      : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))
    await seguirYPresionar('Guardar presupuesto')
    expect(await screen.findByText(/Un presupuesto no admite descuentos sobre tu tope\./, {}, ESPERA)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('guardar la venta marca el resumen de Inicio para volver a pedirlo (no pasa por una mutación de react-query)', async () => {
    mockTipo = 'Presupuesto'
    await armar()
    qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: null })
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'), ESPERA)
    await seguirYPresionar('Guardar presupuesto')
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(qc.getQueryState(['inicio', 'resumen'])?.isInvalidated).toBe(true)
  })

  it('dos toques en el mismo instante mandan un solo presupuesto', async () => {
    mockTipo = 'Presupuesto'
    await armar()
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'), ESPERA)
    await abrirConfirmacion()
    const boton = screen.getByRole('button', { name: 'Guardar presupuesto' })
    // Mismo tick: ningún re-render entre un toque y el otro.
    act(() => { fireEvent.press(boton); fireEvent.press(boton) })
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(mockPost.mock.calls.filter(([u]) => u.endsWith('guardar-presupuesto'))).toHaveLength(1)
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it('dos toques en el mismo instante mandan un solo pedido', async () => {
    await armar()
    await abrirConfirmacion()
    const boton = screen.getByRole('button', { name: 'Confirmar pedido' })
    // Mismo tick: ningún re-render entre un toque y el otro.
    act(() => { fireEvent.press(boton); fireEvent.press(boton) })
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(altas()).toHaveLength(1)
  })

  it.each(['Presupuesto', 'Pedido'])('%s: tras confirmar no se manda ningún PUT al borrador (ni al desmontar ni por el debounce)', async (tipo) => {
    mockTipo = tipo
    await armar()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    const antes = mockPut.mock.calls.length
    await seguirYPresionar(tipo === 'Pedido' ? 'Confirmar pedido' : 'Guardar presupuesto')
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 1200))
    screen.unmount()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockPut.mock.calls).toHaveLength(antes)
  })

  it('la cesión viaja en el alta del pedido', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10, comisionActiva: true, porcentajeComision: 5 } as never })
    await armar()
    await userEvent.press(screen.getByRole('tab', { name: 'Cabecera' }))
    await userEvent.type(screen.getByLabelText('Ceder parte de mi comisión (%)'), '3')
    await confirmar()
    await waitFor(() => expect(altas()).toHaveLength(1))
    expect(altas()[0][1]).toMatchObject({ porcentajeComisionCedido: 3 })
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

describe('V2 y V3: elegir cliente y cómo arrancar', () => {
  const pala = producto({ real: 100, precioVenta: 2600 })
  const pedidoViejo = { id: 'v2', fecha: '2026-10-11T15:00:00Z', estado: 'Entregada', tipoOperacion: 2, itemsCount: 1, totalAmount: 31200 }
  const detalleViejo = {
    venta: { id: 'v2', codigoPedido: 'A00300', clienteId: 'c1', version: 4, estado: 6, tipoOperacion: 2, porcentajeDescuento: 0, metodoEntregaNombre: 'LogisticaPropia', metodoEntrega: 1, fechaEntrega: '2026-10-12T00:00:00', cargoFleteAmount: 0, observaciones: null },
    detalles: [{ id: 'i1', productoId: 'p1', productoNombre: 'Pala', cantidad: 12, porcentajeDescuentoItem: 5, precioUnitario: 2000, stockDisponible: 100 }],
    bultos: [],
  }
  const socioC1 = { id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }
  const conHistorial = () => mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/Ventas?')) return Promise.resolve({ items: [pedidoViejo], hasNextPage: false })
    if (url === '/api/v1/Ventas/v2') return Promise.resolve(detalleViejo)
    if (url === '/api/v1/socios-comerciales/c1') return Promise.resolve(socioC1)
    if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
    return Promise.resolve(calendario(url))
  })
  beforeEach(() => useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never }))

  it('?clienteId= salta la lista: llega a "¿Cómo arrancás?" con ese cliente y arrancar crea el borrador para él', async () => {
    conHistorial()
    pantalla({ clienteId: 'c1' })
    expect(await screen.findByText('¿Cómo arrancás?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Elegir Tarantino' })).toBeNull()
    expect(screen.getByText('Tarantino 1898')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Buscar en el catálogo' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Pedido' }))
  })

  it('sin ?clienteId= se elige de la lista (V2) y recién después se elige el tipo (V3)', async () => {
    conHistorial()
    pantalla()
    expect(mockPost).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    expect(await screen.findByText('¿Cómo arrancás?')).toBeTruthy()
    // Elegir el cliente no crea nada: el borrador nace con el tipo que se elige acá.
    expect(mockPost).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
    await userEvent.press(screen.getByRole('button', { name: 'Buscar en el catálogo' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Presupuesto' }))
  })

  it('la flecha de V3 vuelve a la lista de clientes', async () => {
    conHistorial()
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    await screen.findByText('¿Cómo arrancás?')
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByRole('button', { name: 'Elegir Tarantino' })).toBeTruthy()
  })

  it('con ?clienteId= la flecha de V3 lleva a la lista y no vuelve a elegir sola al mismo cliente', async () => {
    conHistorial()
    pantalla({ clienteId: 'c1' })
    await screen.findByText('¿Cómo arrancás?')
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByRole('button', { name: 'Elegir Tarantino' })).toBeTruthy()
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByText('¿Cómo arrancás?')).toBeNull()
  })

  it('tablet horizontal (TV2): la lista y el cliente con las formas de arrancar quedan juntos', async () => {
    mockDims.mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 })
    conHistorial()
    pantalla()
    expect(screen.getByText('Elegí un cliente para empezar la venta.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    expect(await screen.findByText('¿Cómo arrancás?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Elegir Tarantino' })).toBeTruthy()
    expect(screen.queryByText('Elegí un cliente para empezar la venta.')).toBeNull()
  })

  it('Repetir el último pedido: crea el borrador y carga las líneas con los precios y el stock de hoy', async () => {
    conHistorial()
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Repetir el último pedido' }))
    expect(await screen.findByText('Nuevo pedido', {}, ESPERA)).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Pedido' })
    // La fila del catálogo de hoy (2.600), no el precio de aquel pedido (2.000); la cantidad y el descuento son los del pedido.
    await waitFor(() => expect(useCarritoVenta.getState().lineas).toEqual([{ productoId: 'p1', producto: pala, cantidad: 12, descuentoPct: 5 }]), ESPERA)
    expect(screen.getByText('12 × $ 2.600,00')).toBeTruthy()
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1].items).toEqual([{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 5 }]), ESPERA)
    // El pedido que se repite no se toca.
    expect(mockPut.mock.calls.every(([u]) => u === '/api/v1/Ventas/b1')).toBe(true)
  })

  it('Repetir con un servidor que falla deja armar la venta de cero', async () => {
    conHistorial()
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => url === '/api/v1/Ventas/v2' ? Promise.reject(new ApiError(500, 'Error del servidor')) : base(url))
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Repetir el último pedido' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Armar la venta de cero' }, ESPERA))
    expect(await screen.findByText('Nuevo pedido')).toBeTruthy()
    expect(useCarritoVenta.getState().lineas).toEqual([])
  })

  it('Escanear en la góndola abre el catálogo con el escáner', async () => {
    conHistorial()
    pantalla({ clienteId: 'c1' })
    await userEvent.press(await screen.findByRole('button', { name: 'Escanear en la góndola' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', expect.objectContaining({ clienteId: 'c1' })))
    expect(screen.getByRole('button', { name: 'Ver venta' })).toBeTruthy()
  })
})

describe('V7 Confirmar', () => {
  const pala = producto({ real: 100 })
  beforeEach(() => useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never }))
  const conLinea = async (descuentoPct: number, cantidad = 12) => {
    act(() => useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: pala, cantidad, descuentoPct }] }))
    await screen.findByText('Pala c/Cabo Fija LP')
  }

  it('"Seguir" abre Confirmar con el resumen, la fecha de entrega y la nota; todavía no se manda nada', async () => {
    await elegirCliente()
    await conLinea(0)
    await abrirConfirmacion()
    expect(screen.getByText('¿Cuándo se entrega?')).toBeTruthy()
    expect(screen.getByText('1 producto · 12 unidades')).toBeTruthy()
    expect(screen.getByTestId('confirmar-total')).toHaveTextContent('$ 29.952,00')
    expect(screen.getByLabelText('Nota para el depósito y el chofer')).toBeTruthy()
    expect(mockPost.mock.calls.filter(([u]) => u === '/api/v1/Ventas')).toHaveLength(0)
  })

  it('la nota de V7 es la observación de la venta y viaja con el pedido', async () => {
    mockPost.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas' ? { ventaId: 'v9', version: 1, message: 'ok' } : { ventaId: 'b1', version: 7, message: '' }))
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/v9' ? { venta: { estado: 2 }, detalles: [] } : calendario(url)))
    await elegirCliente()
    await conLinea(0)
    await abrirConfirmacion()
    await userEvent.type(screen.getByLabelText('Nota para el depósito y el chofer'), 'Entrar por el portón de atrás')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.objectContaining({ observaciones: 'Entrar por el portón de atrás' })))
  })

  it('un descuento sobre el tope avisa en V7 que el pedido queda por autorizar, y se puede confirmar', async () => {
    await elegirCliente()
    await conLinea(15)
    await abrirConfirmacion()
    expect(await screen.findByText('Queda por autorizar')).toBeTruthy()
    expect(within(screen.getByLabelText('Confirmar venta')).getByText(/Porque un descuento supera tu tope/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
  })

  it('un presupuesto con un descuento sobre el tope no se puede guardar: botón deshabilitado y el motivo', async () => {
    mockTipo = 'Presupuesto'
    await elegirCliente()
    await conLinea(15)
    await abrirConfirmacion()
    expect(screen.getByRole('button', { name: 'Guardar presupuesto' })).toBeDisabled()
    expect(screen.getByText('Un presupuesto no puede pasar tu tope de descuento')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar presupuesto' }))
    expect(mockPost.mock.calls.filter(([u]) => String(u).endsWith('guardar-presupuesto'))).toHaveLength(0)
  })

  it('un presupuesto dentro del tope se guarda como antes y no muestra ese motivo', async () => {
    mockTipo = 'Presupuesto'
    await elegirCliente()
    await conLinea(10)
    await abrirConfirmacion()
    expect(screen.getByRole('button', { name: 'Guardar presupuesto' })).toBeEnabled()
    expect(screen.queryByText('Un presupuesto no puede pasar tu tope de descuento')).toBeNull()
  })

  it('un presupuesto con el descuento general sobre el tope también queda bloqueado', async () => {
    mockTipo = 'Presupuesto'
    await elegirCliente()
    await conLinea(0)
    await aplicarDescuentoGeneral(12)
    await abrirConfirmacion()
    expect(screen.getByRole('button', { name: 'Guardar presupuesto' })).toBeDisabled()
  })

  it('el descuento general se cambia desde la hoja y baja el total', async () => {
    await elegirCliente()
    await conLinea(0, 10)
    await userEvent.press(screen.getByRole('button', { name: 'Descuento a toda la venta' }))
    await userEvent.press(screen.getByRole('button', { name: '5 %' }))
    await userEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByTestId('venta-total')).toHaveTextContent('$ 23.712,00') // 10 × 2.496 − 5 %
  })

  it('en Líneas, + y − suman o restan un múltiplo y la línea sale de la venta al llegar a cero', async () => {
    await elegirCliente()
    await conLinea(0, 1)
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Pala c/Cabo Fija LP' }))
    expect(useCarritoVenta.getState().lineas[0].cantidad).toBe(2)
    await userEvent.press(screen.getByRole('button', { name: 'Restar Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('button', { name: 'Restar Pala c/Cabo Fija LP' }))
    expect(useCarritoVenta.getState().lineas).toEqual([])
  })
})

describe('ruta ventas/nueva-v2 con ?clienteId=', () => {
  const Ruta = require('../../../../app/(tabs)/ventas/nueva-v2').default
  it('le pasa el cliente a la pantalla y no abre ninguna venta existente', async () => {
    useAuthStore.setState({ user: { id: 'u', username: 'u', roles: ['Administrador'] as never, permissions: [] } })
    useVentaNuevaStore.setState({ activa: true })
    mockParams = { clienteId: 'c1' }
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/api/v1/socios-comerciales/c1' ? { id: 'c1', direccion: 'Tarantino 1898' } : calendario(url)))
    const qcRuta = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qcRuta}><Ruta /></QueryClientProvider>)
    expect(await screen.findByText('¿Cómo arrancás?')).toBeTruthy()
    mockParams = {}
  })
})
