import React from 'react'
import { Alert, Text } from 'react-native'
import { act, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { diaArgentina } from '@/src/utils/date'
import { ListaVentasNueva } from '../../components/ListaVentasNueva'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const ahora = new Date()
const venta = (o: Record<string, unknown>) => ({
  id: 'v1', codigoPedido: 'A00418', vendedorNombre: 'Emanuel Parraquini', direccionCliente: 'Juan B. Justo 6376',
  nombreFantasiaCliente: 'Carlos', razonSocialCliente: 'Carlos SRL', fecha: ahora.toISOString(), estado: 'Confirmada',
  totalAmount: 214560, tipoOperacion: 2, ...o,
})
const pagina = (items: unknown[], totalCount: number) => ({ items, page: 1, pageSize: 20, totalCount, totalPages: 1, hasNextPage: false })

/** Parámetros de la última llamada a GET /Ventas (lo que se le pidió al servidor). */
function ultimaConsulta(): URLSearchParams {
  const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Ventas?'))
  return new URLSearchParams(urls[urls.length - 1]!.split('?')[1])
}

function pantalla(ancho = 390) {
  mockDims.mockReturnValue({ width: ancho, height: 800, scale: 2, fontScale: 1 })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ListaVentasNueva detalle={(id) => <Text>{`detalle ${id}`}</Text>} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  mockGet.mockImplementation((url: string) => {
    if (url.includes('borradores/mios')) {
      return Promise.resolve([{ id: 'b1', version: 1, clienteId: 'c', clienteNombre: 'Almacén Luis', depositoId: 'd', fechaModificacion: ahora.toISOString(), cantidadLineas: 3 }])
    }
    return Promise.resolve(pagina([
      venta({}),
      venta({ id: 'v2', codigoPedido: 'A00415', direccionCliente: 'Brandsen 3314', nombreFantasiaCliente: 'Sofía', fecha: subDays(ahora, 1).toISOString(), estado: 'Entregada' }),
    ], 61))
  })
})

describe('lista de ventas nueva', () => {
  it('arranca en Pedidos de los últimos 30 días, agrupa por día y el contador es del servidor', async () => {
    pantalla()
    expect(await screen.findByText('Mostrando 2 de 61')).toBeTruthy()
    const q = ultimaConsulta()
    expect(q.get('tipoOperacion')).toBe('2')
    expect(q.get('fechaDesde')).toBe(diaArgentina(subDays(ahora, 29).getTime()))
    expect(q.get('estado')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Pedidos' })).toBeSelected()
    expect(screen.getByRole('header', { name: 'Hoy' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Ayer' })).toBeTruthy()
    // La dirección identifica al cliente; el nombre va en línea aparte.
    const tarjeta = screen.getByRole('button', { name: /A00418/ })
    expect(within(tarjeta).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(tarjeta).getByText('Carlos')).toBeTruthy()
    expect(within(tarjeta).getByText('Confirmado')).toBeTruthy()
  })

  it('Presupuestos, estado y período van como filtros al servidor', async () => {
    pantalla()
    await screen.findByText('Mostrando 2 de 61')
    await userEvent.press(screen.getByRole('tab', { name: 'Presupuestos' }))
    await waitFor(() => expect(ultimaConsulta().get('tipoOperacion')).toBe('1'))
    await userEvent.press(screen.getByRole('radio', { name: 'Por autorizar' }))
    await waitFor(() => expect(ultimaConsulta().get('estado')).toBe('PendienteAutorizacion'))
    await userEvent.press(screen.getByRole('radio', { name: 'Todo' }))
    await waitFor(() => expect(ultimaConsulta().get('fechaDesde')).toBeNull())
    expect(ultimaConsulta().get('tipoOperacion')).toBe('1')
    // Con estado elegido el contador sigue siendo el del servidor.
    expect(screen.getByText('Mostrando 2 de 61')).toBeTruthy()
  })

  it('la búsqueda va al servidor después de una pausa, no con cada letra', async () => {
    pantalla()
    await screen.findByText('Mostrando 2 de 61')
    await userEvent.type(screen.getByLabelText('Buscar'), 'luis')
    expect(ultimaConsulta().get('searchTerm')).toBeNull()
    await waitFor(() => expect(ultimaConsulta().get('searchTerm')).toBe('luis'))
    const conBusqueda = mockGet.mock.calls.filter(([u]) => String(u).includes('searchTerm=')).map(([u]) => String(u))
    expect(conBusqueda.every((u) => u.includes('searchTerm=luis'))).toBe(true)
  })

  it('Borradores muestra los del usuario que devuelve el servidor', async () => {
    pantalla()
    await userEvent.press(screen.getByRole('tab', { name: 'Borradores' }))
    expect(await screen.findByText('Almacén Luis')).toBeTruthy()
    expect(screen.getByText(/3 líneas · Guardado hoy/)).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Ventas/borradores/mios')
  })

  it('tocar un borrador pregunta si sigue como pedido o presupuesto y lo abre en la venta nueva', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => botones?.find((b) => b.text === 'Como pedido')?.onPress?.())
    pantalla()
    await userEvent.press(screen.getByRole('tab', { name: 'Borradores' }))
    await userEvent.press(await screen.findByRole('button', { name: /Almacén Luis/ }))
    expect(alerta).toHaveBeenCalledWith('Retomar borrador', 'Almacén Luis', expect.any(Array))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva-v2?borrador=b1&tipo=Pedido')
    alerta.mockRestore()
  })

  it('en el teléfono tocar una tarjeta abre el detalle de la venta', async () => {
    pantalla(390)
    await userEvent.press(await screen.findByRole('button', { name: /A00415/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/v2')
  })

  it('en tablet horizontal el detalle se abre al costado, sin salir de la lista', async () => {
    pantalla(1200)
    expect(await screen.findByText('Elegí una venta para ver el detalle.')).toBeTruthy()
    await userEvent.press(await screen.findByRole('button', { name: /A00415/ }))
    expect(within(screen.getByTestId('two-pane-detail')).getByText('detalle v2')).toBeTruthy()
    expect(within(screen.getByTestId('two-pane-list')).getByRole('button', { name: /A00418/ })).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('lista de ventas nueva: total del filtro (GET /Ventas/resumen)', () => {
  const RESUMEN = '/api/v1/Ventas/resumen?'
  /** El resumen que contesta el servidor; el resto de las URLs, como en el beforeEach. */
  function conResumen(resumen: object) {
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url.startsWith(RESUMEN) ? Promise.resolve(resumen) : base(url)))
  }
  function ultimoResumen(): URLSearchParams {
    const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith(RESUMEN))
    return new URLSearchParams(urls[urls.length - 1]!.split('?')[1])
  }
  /** Los filtros de una consulta, sin la paginación. */
  const filtros = (q: URLSearchParams) => { q.delete('pageNumber'); q.delete('pageSize'); q.sort(); return q.toString() }

  // forward-system #873: el resumen aplica tipo y estado y trae `cantidad`.
  const servidorNuevo = { totalVendido: 6860919, pendientes: 3, porAutorizar: 1, entregadas: 20, cantidad: 61 }

  it('en Pedidos suma el importe del servidor, pedido con los mismos filtros que la lista', async () => {
    conResumen(servidorNuevo)
    pantalla()
    expect(await screen.findByText('Mostrando 2 de 61 · $ 6.860.919,00')).toBeTruthy()
    expect(filtros(ultimoResumen())).toBe(filtros(ultimaConsulta()))
    await userEvent.press(screen.getByRole('radio', { name: 'Entregado' }))
    await userEvent.type(screen.getByLabelText('Buscar'), 'luis')
    await waitFor(() => expect(ultimoResumen().get('searchTerm')).toBe('luis'))
    expect(ultimoResumen().get('estado')).toBe('Entregada')
    expect(ultimoResumen().get('tipoOperacion')).toBe('2')
    expect(filtros(ultimoResumen())).toBe(filtros(ultimaConsulta()))
  })

  it('en Presupuestos y con Anulado solo la cantidad: el importe del servidor es de pedidos no anulados', async () => {
    conResumen(servidorNuevo)
    pantalla()
    await screen.findByText('Mostrando 2 de 61 · $ 6.860.919,00')
    await userEvent.press(screen.getByRole('radio', { name: 'Anulado' }))
    expect(await screen.findByText('Mostrando 2 de 61')).toBeTruthy()
    await userEvent.press(screen.getByRole('radio', { name: 'Todos' }))
    await screen.findByText('Mostrando 2 de 61 · $ 6.860.919,00')
    await userEvent.press(screen.getByRole('tab', { name: 'Presupuestos' }))
    await waitFor(() => expect(ultimoResumen().get('tipoOperacion')).toBe('1'))
    expect(await screen.findByText('Mostrando 2 de 61')).toBeTruthy()
    expect(screen.queryByText(/6\.860\.919/)).toBeNull()
  })

  it('con el servidor anterior a #873 (resumen sin cantidad) queda el contador de la lista, sin importe', async () => {
    // Ese resumen ignora tipo y estado: su total mezcla presupuestos y pedidos.
    conResumen({ totalVendido: 999999, pendientes: 3, porAutorizar: 1, entregadas: 20 })
    pantalla()
    await waitFor(() => expect(mockGet.mock.calls.some(([u]) => String(u).startsWith(RESUMEN))).toBe(true))
    expect(await screen.findByText('Mostrando 2 de 61')).toBeTruthy()
    await act(async () => {})
    expect(screen.queryByText(/999\.999/)).toBeNull()
  })
})
