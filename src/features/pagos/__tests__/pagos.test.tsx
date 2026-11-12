import React from 'react'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import PagosScreen from '../../../../app/(tabs)/tesoreria/pagos/index'
import DetalleDePagoScreen from '../../../../app/(tabs)/tesoreria/pagos/[id]'
import { DeudasAProveedores } from '@/features/cuentas/components/DeudasAProveedores'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

const mockPush = jest.fn()
let mockParams: Record<string, string | undefined> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

const VER_PAGOS = [{ module: 'MOD_PAGOS', canRead: true }, { module: 'CAP_VER_TESORERIA', canRead: true }]
const PAGAR = [{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'CAP_VER_TESORERIA', canRead: true }]

/** Un renglón de `GET /Tesoreria?fuente=pago` (TesoreriaListDto). */
const renglon = (id: string, extra: object = {}) => ({
  id,
  fecha: '2026-11-10T13:30:00Z',
  monto: 25000,
  moneda: 'ARS',
  tipoNombre: 'Pago a proveedor',
  cuentaOrigenNombre: 'Caja',
  socioRazonSocial: 'Molinos SA',
  observaciones: 'Efectivo',
  factor: -1,
  esAnulacion: false,
  estaAnulado: false,
  fuente: 'pago',
  sinMovimientoDeCaja: false,
  creadoPorNombre: 'Ana Gómez',
  ...extra,
})
const paginaDe = (items: object[], page = 1, totalPages = 1) => ({ items, page, pageSize: 20, totalCount: items.length, totalPages, hasNextPage: page < totalPages })

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
})

describe('Tesorería: fila "Pagos"', () => {
  it('con MOD_PAGOS:Read y CAP_VER_TESORERIA (la regla de /finanzas/pagos en la web) muestra "Pagos" y lleva a la lista', async () => {
    conPermisos(VER_PAGOS)
    renderConQuery(<TesoreriaScreen />)
    await userEvent.press(await screen.findByRole('button', { name: 'Pagos' }, ESPERA))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/pagos')
  })

  it('sin CAP_VER_TESORERIA, o sin MOD_PAGOS:Read, la fila no está', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    const { unmount } = renderConQuery(<TesoreriaScreen />)
    await screen.findByRole('button', { name: 'Pagar un servicio' }, ESPERA)
    expect(screen.queryByRole('button', { name: 'Pagos' })).toBeNull()
    unmount()

    conPermisos([{ module: 'CAP_VER_TESORERIA', canRead: true }])
    renderConQuery(<TesoreriaScreen />)
    await screen.findByRole('button', { name: 'Pagar un servicio' }, ESPERA)
    expect(screen.queryByRole('button', { name: 'Pagos' })).toBeNull()
  })
})

describe('Lista de pagos', () => {
  beforeEach(() => {
    conPermisos(VER_PAGOS)
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/Tesoreria?') ? paginaDe([renglon('t1')]) : null))
  })

  const urls = () => get.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/v1/Tesoreria?'))

  it('arranca en "Pagos" (a proveedores) y cada chip pide su categoría; "Todos", sin categoría', async () => {
    renderConQuery(<PagosScreen />)
    await screen.findByText('Molinos SA', {}, ESPERA)
    expect(urls()[0]).toBe('/api/v1/Tesoreria?fuente=pago&categoria=proveedor&pageNumber=1&pageSize=20')

    await userEvent.press(screen.getByRole('radio', { name: 'Cobros' }))
    await waitFor(() => expect(urls()).toContain('/api/v1/Tesoreria?fuente=pago&categoria=cliente&pageNumber=1&pageSize=20'), ESPERA)

    await userEvent.press(screen.getByRole('radio', { name: 'Todos' }))
    await waitFor(() => expect(urls()).toContain('/api/v1/Tesoreria?fuente=pago&pageNumber=1&pageSize=20'), ESPERA)
  })

  it('al llegar al final pide la página siguiente', async () => {
    get.mockImplementation(async (url: string) => {
      if (!url.startsWith('/api/v1/Tesoreria?')) return null
      return url.includes('pageNumber=2') ? paginaDe([renglon('t2', { socioRazonSocial: 'Lácteos SRL' })], 2, 2) : paginaDe([renglon('t1')], 1, 2)
    })
    renderConQuery(<PagosScreen />)
    await screen.findByText('Molinos SA', {}, ESPERA)

    fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached')

    expect(await screen.findByText('Lácteos SRL', {}, ESPERA)).toBeTruthy()
    expect(urls()).toContain('/api/v1/Tesoreria?fuente=pago&categoria=proveedor&pageNumber=2&pageSize=20')
  })

  it('la búsqueda y el período van al servidor', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'], now: new Date('2026-11-11T15:00:00Z') })
    try {
      renderConQuery(<PagosScreen />)
      await screen.findByText('Molinos SA', {}, ESPERA)
      fireEvent.changeText(screen.getByLabelText('Buscar'), 'molinos')
      jest.advanceTimersByTime(1000)
      await waitFor(() => expect(urls().some(u => u.includes('searchTerm=molinos'))).toBe(true), ESPERA)

      fireEvent.press(screen.getByRole('button', { name: 'Este mes' }))
      await waitFor(() => expect(urls().some(u => u.includes('fechaDesde=2026-11-01&fechaHasta=2026-11-11'))).toBe(true), ESPERA)
    } finally {
      jest.useRealTimers()
    }
  })

  it('cada renglón: sentido (entra, sale o sin movimiento), entidad, quién lo registró, monto y los avisos ANULADO y "Sin movimiento de caja"', async () => {
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/Tesoreria?') ? paginaDe([
      renglon('t1'),
      renglon('t2', { socioRazonSocial: 'Kiosco Chela', factor: 1, tipoNombre: 'Cobro', estaAnulado: true, monto: 12000 }),
      renglon('t3', { socioRazonSocial: 'Flete Sur', factor: 0, sinMovimientoDeCaja: true, monto: 5000 }),
    ]) : null))
    renderConQuery(<PagosScreen />)

    const sale = await screen.findByLabelText(/^Sale, Molinos SA, /, {}, ESPERA)
    expect(sale.props.accessibilityLabel).toContain(`Molinos SA, ${$(25000)}, Pago a proveedor`)
    expect(within(sale).getByText('Registró Ana Gómez')).toBeTruthy()
    expect(within(sale).getByText($(25000))).toBeTruthy()
    expect(within(sale).queryByText('ANULADO')).toBeNull()

    const entra = screen.getByLabelText(/^Entra, Kiosco Chela/)
    expect(within(entra).getByText('ANULADO')).toBeTruthy()

    const neutro = screen.getByLabelText(/^Sin movimiento de caja, Flete Sur/)
    expect(within(neutro).getByText('Sin movimiento de caja')).toBeTruthy()
  })

  it('tocar un renglón abre su detalle', async () => {
    renderConQuery(<PagosScreen />)
    await userEvent.press(await screen.findByRole('button', { name: /Molinos SA/ }, ESPERA))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/tesoreria/pagos/[id]', params: { id: 't1' } })
  })

  it('sin pagos lo dice; si el servidor falla, muestra el error con reintentar', async () => {
    get.mockResolvedValue(paginaDe([]))
    const { unmount } = renderConQuery(<PagosScreen />)
    expect(await screen.findByText('No hay pagos a proveedores.', {}, ESPERA)).toBeTruthy()
    unmount()

    get.mockRejectedValue(new Error('El servidor no respondió.'))
    renderConQuery(<PagosScreen />)
    expect(await screen.findByText('El servidor no respondió.', {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('"Pagar a proveedor" va con MOD_PAGOS crear y leer, y abre el pago sin proveedor elegido', async () => {
    const { unmount } = renderConQuery(<PagosScreen />)
    await screen.findByText('Molinos SA', {}, ESPERA)
    expect(screen.queryByRole('button', { name: 'Pagar a proveedor' })).toBeNull()
    unmount()

    conPermisos(PAGAR)
    renderConQuery(<PagosScreen />)
    await userEvent.press(await screen.findByRole('button', { name: 'Pagar a proveedor' }, ESPERA))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/pagos/pagar')
  })

  it('sin permiso para ver pagos no pide nada y lo dice', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    renderConQuery(<PagosScreen />)
    expect(await screen.findByText('No podés ver los pagos', {}, ESPERA)).toBeTruthy()
    expect(get).not.toHaveBeenCalled()
  })
})

describe('Detalle de un pago', () => {
  it('muestra el socio, el monto, el medio, quién lo registró, a qué se imputó y las conciliaciones (GET /Pagos/{id})', async () => {
    conPermisos(VER_PAGOS)
    mockParams = { id: 'pg1' }
    get.mockImplementation(async (url: string) => (url === '/api/v1/Pagos/pg1' ? {
      id: 'pg1',
      socioComercialId: 'p1',
      razonSocialSocio: 'Molinos SA',
      tipoSocio: 'Proveedor',
      fecha: '2026-11-10T13:30:00Z',
      fechaOperacion: '2026-11-10T13:30:00Z',
      montoAmount: 25000,
      montoMoneda: 'ARS',
      medioPago: 'Transferencia',
      activo: true,
      creadoPorNombre: 'Ana Gómez',
      conciliaciones: [{ id: 'k1', movimientoCuentaId: 'mc1', referenciaMovimiento: 'Extracto 4411', montoAplicadoAmount: 25000 }],
      imputaciones: [{ id: 'i1', ventaId: 'v1', codigoVenta: 'C-00031', montoAmount: 25000, origen: 'Automatica' }],
    } : null))
    renderConQuery(<DetalleDePagoScreen />)

    expect(await screen.findByText('Molinos SA', {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText(`Monto: ${$(25000)}`)).toBeTruthy()
    expect(screen.getByText('Transferencia')).toBeTruthy()
    expect(screen.getByText('Registró Ana Gómez')).toBeTruthy()
    expect(screen.getByLabelText(`C-00031: ${$(25000)}`)).toBeTruthy()
    expect(screen.getByLabelText(`Extracto 4411: ${$(25000)}`)).toBeTruthy()
    expect(screen.queryByText('ANULADO')).toBeNull()
  })

  it('un pago anulado lo dice', async () => {
    conPermisos(VER_PAGOS)
    mockParams = { id: 'pg2' }
    get.mockResolvedValue({
      id: 'pg2', socioComercialId: 'p1', razonSocialSocio: 'Molinos SA', fecha: '2026-11-10T13:30:00Z', fechaOperacion: '2026-11-10T13:30:00Z',
      montoAmount: 1000, medioPago: 'Efectivo', activo: false, conciliaciones: [], imputaciones: [],
    })
    renderConQuery(<DetalleDePagoScreen />)
    expect(await screen.findByText('ANULADO', {}, ESPERA)).toBeTruthy()
  })
})

describe('Debo: "Pagar" en cada proveedor', () => {
  const deudas = {
    pagina: { page: 1, totalCount: 1, totalPages: 1, hasNextPage: false, items: [{ socioId: 'p1', razonSocial: 'Molinos SA', saldoDeuda: 61000, diasDeudaMasVieja: 49 }] },
    deudaTotal: 61000,
  }

  it('con permiso para pagar, "Pagar" abre el pago de ese proveedor', async () => {
    conPermisos(PAGAR)
    get.mockResolvedValue(deudas)
    const onPagar = jest.fn()
    renderConQuery(<DeudasAProveedores onPagar={onPagar} />)
    await userEvent.press(await screen.findByRole('button', { name: 'Pagar a Molinos SA' }, ESPERA))
    expect(onPagar).toHaveBeenCalledWith('p1')
  })

  it('sin permiso para pagar, la fila sigue de solo lectura', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    get.mockResolvedValue(deudas)
    renderConQuery(<DeudasAProveedores onPagar={jest.fn()} />)
    expect(await screen.findByLabelText(`Molinos SA, le debés ${$(61000)}, Vencida · 49 días`, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Pagar/ })).toBeNull()
  })
})
