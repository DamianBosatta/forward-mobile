import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import ComprasListScreen from '../../../../../app/(tabs)/compras/index'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({ canDo: () => true }),
}))
jest.mock('../../../../../app/(tabs)/compras/[id]', () => {
  const { Text: T } = require('react-native')
  return { CompraDetalle: ({ id }: { id: string }) => <T>{`detalle ${id}`}</T> }
})
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const ahora = new Date()
const compra = (o: Record<string, unknown>) => ({
  id: 'aaaa1111-0000-0000-0000-000000000000', proveedorId: 'p', razonSocialProveedor: 'Insumos del Sur SA', depositoId: 'd',
  nombreDeposito: 'Depósito Central', fecha: ahora.toISOString(), estado: 'NotaPedido', totalAmount: 358777, itemsCount: 8, eliminada: false, ...o,
})
const pagina = (items: unknown[], totalCount: number) => ({ items, page: 1, pageSize: 20, totalCount, totalPages: 1, hasNextPage: false })

/** Parámetros de la última llamada a GET /Compras (lo que se le pidió al servidor). */
function ultimaConsulta(): URLSearchParams {
  const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Compras?'))
  return new URLSearchParams(urls[urls.length - 1]!.split('?')[1])
}

function pantalla(ancho = 390) {
  mockDims.mockReturnValue({ width: ancho, height: 800, scale: 2, fontScale: 1 })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ComprasListScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  mockGet.mockImplementation((url: string) => {
    if (url.includes('borradores/mios')) {
      return Promise.resolve([{ id: 'b1', version: 1, proveedorId: 'p', proveedorNombre: 'Gorrión Mayorista', depositoId: 'd', fechaModificacion: ahora.toISOString(), cantidadLineas: 3 }])
    }
    if (url.includes('/resumen')) {
      return Promise.resolve({ totalComprado: 999, notasPedido: 4, confirmadas: 1, entregadas: 7, canceladas: 0, anuladas: 0 })
    }
    return Promise.resolve(pagina([
      compra({}),
      compra({ id: 'bbbb2222-0000-0000-0000-000000000000', razonSocialProveedor: 'Saphirus Distribución', fecha: subDays(ahora, 1).toISOString(), estado: 'Confirmado', itemsCount: 1 }),
    ], 5))
  })
})

describe('lista de compras', () => {
  it('arranca en Pendientes: pide nota de pedido y confirmadas al servidor, con contador y resumen del servidor', async () => {
    pantalla()
    expect(await screen.findByText('Mostrando 2 de 5')).toBeTruthy()
    expect(ultimaConsulta().getAll('Estados')).toEqual(['NotaPedido', 'Confirmado'])
    expect(ultimaConsulta().get('FechaDesde')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Pendientes' })).toBeSelected()
    expect(await screen.findByText('4 notas de pedido · 1 por recibir')).toBeTruthy()
    // No se muestra el total comprado: el servidor suma monedas distintas.
    expect(screen.queryByText(/999/)).toBeNull()
    expect(screen.getByRole('header', { name: 'Hoy' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Ayer' })).toBeTruthy()
    // El proveedor es el título; el estado sale del chip único.
    const tarjeta = screen.getByRole('button', { name: /AAAA1111/ })
    expect(within(tarjeta).getByText('Insumos del Sur SA')).toBeTruthy()
    expect(within(tarjeta).getByText('Pendiente')).toBeTruthy()
    expect(within(tarjeta).getByText(/8 productos/)).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /BBBB2222/ })).getByText('Por recibir')).toBeTruthy()
  })

  it('con el servidor que manda quién la cargó, la tarjeta lo muestra al lado del número y el depósito pasa al pie', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('borradores/mios')) return Promise.resolve([])
      if (url.includes('/resumen')) return Promise.resolve({ totalComprado: 0, notasPedido: 1, confirmadas: 0, entregadas: 0, canceladas: 0, anuladas: 0 })
      return Promise.resolve(pagina([compra({ creadoPor: 'Nacho Damiano' })], 1))
    })
    pantalla()
    const tarjeta = await screen.findByRole('button', { name: /AAAA1111/ })
    expect(within(tarjeta).getByText('AAAA1111 · Nacho Damiano')).toBeTruthy()
    expect(within(tarjeta).getByText(/8 productos · Depósito Central/)).toBeTruthy()
  })

  it('con el servidor que dice cuándo llega, la compra por recibir lo muestra en el pie', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('borradores/mios')) return Promise.resolve([])
      if (url.includes('/resumen')) return Promise.resolve({ totalComprado: 0, notasPedido: 0, confirmadas: 1, entregadas: 0, canceladas: 0, anuladas: 0 })
      return Promise.resolve(pagina([compra({ estado: 'Confirmado', fechaEsperadaRecepcion: '2026-10-08' })], 1))
    })
    pantalla()
    const tarjeta = await screen.findByRole('button', { name: /AAAA1111/ })
    expect(within(tarjeta).getByText(/8 productos · Llega jue 8$/)).toBeTruthy()
  })

  it('con el número correlativo del servidor (9C), la tarjeta dice C-00232 en vez del id', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('borradores/mios')) return Promise.resolve([])
      if (url.includes('/resumen')) return Promise.resolve({ totalComprado: 0, notasPedido: 1, confirmadas: 0, entregadas: 0, canceladas: 0, anuladas: 0 })
      return Promise.resolve(pagina([compra({ numero: 232, creadoPor: 'Nacho Damiano' })], 1))
    })
    pantalla()
    const tarjeta = await screen.findByRole('button', { name: /C-00232/ })
    expect(within(tarjeta).getByText('C-00232 · Nacho Damiano')).toBeTruthy()
  })

  it('con el servidor anterior (sin creadoPor) la tarjeta sigue mostrando el depósito al lado del número', async () => {
    pantalla()
    const tarjeta = await screen.findByRole('button', { name: /AAAA1111/ })
    expect(within(tarjeta).getByText('AAAA1111 · Depósito Central')).toBeTruthy()
    expect(within(tarjeta).queryByText(/productos · /)).toBeNull()
  })

  it('con el servidor que separa por moneda vuelve el total comprado, una cifra por moneda y con el mismo período', async () => {
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => url.startsWith('/api/v1/Compras/resumen?')
      ? Promise.resolve({ totalComprado: 999, totalesPorMoneda: [{ moneda: 'ARS', total: 998 }, { moneda: 'USD', total: 1 }], notasPedido: 4, confirmadas: 1, entregadas: 7, canceladas: 0, anuladas: 0 })
      : base(url))
    pantalla()
    expect(await screen.findByText('Comprado (pendientes y recibidas): $ 998,00 · USD 1,00')).toBeTruthy()
    expect(screen.queryByText(/999/)).toBeNull()
    await userEvent.press(screen.getByRole('radio', { name: '7 días' }))
    await waitFor(() => expect(ultimaConsulta().get('FechaDesde')).toMatch(/^\d{4}-\d{2}-\d{2}$/))
    const resumenes = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Compras/resumen?'))
    expect(new URLSearchParams(resumenes.at(-1)!.split('?')[1]).get('FechaDesde')).toBe(ultimaConsulta().get('FechaDesde'))
  })

  it('con el servidor que recorta por pestaña, el importe de la pestaña va junto al contador (9B prioridad 3)', async () => {
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => {
      if (!url.startsWith('/api/v1/Compras/resumen?')) return base(url)
      const estados = new URLSearchParams(url.split('?')[1]).getAll('Estados')
      const total = estados.includes('Entregado') ? 500 : 2118577
      return Promise.resolve({
        totalComprado: 999, totalesPorMoneda: [{ moneda: 'ARS', total }], estadosTotalesPorMoneda: estados,
        notasPedido: 4, confirmadas: 1, entregadas: 7, canceladas: 0, anuladas: 0,
      })
    })
    pantalla()
    expect(await screen.findByText('Mostrando 2 de 5 · $ 2.118.577,00')).toBeTruthy()
    expect(screen.queryByText(/Comprado \(pendientes y recibidas\)/)).toBeNull()
    const resumenes = () => mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Compras/resumen?'))
    expect(new URLSearchParams(resumenes().at(-1)!.split('?')[1]).getAll('Estados')).toEqual(['NotaPedido', 'Confirmado'])
    await userEvent.press(screen.getByRole('tab', { name: 'Recibidas' }))
    expect(await screen.findByText('Mostrando 2 de 5 · $ 500,00')).toBeTruthy()
    expect(new URLSearchParams(resumenes().at(-1)!.split('?')[1]).getAll('Estados')).toEqual(['Entregado'])
  })

  it('Recibidas y el período van como filtros al servidor', async () => {
    pantalla()
    await screen.findByText('Mostrando 2 de 5')
    await userEvent.press(screen.getByRole('tab', { name: 'Recibidas' }))
    await waitFor(() => expect(ultimaConsulta().getAll('Estados')).toEqual(['Entregado']))
    expect(await screen.findByText('7 recibidas')).toBeTruthy()
    await userEvent.press(screen.getByRole('radio', { name: '7 días' }))
    await waitFor(() => expect(ultimaConsulta().get('FechaDesde')).toMatch(/^\d{4}-\d{2}-\d{2}$/))
    expect(ultimaConsulta().getAll('Estados')).toEqual(['Entregado'])
  })

  it('la búsqueda va al servidor después de una pausa, no con cada letra', async () => {
    pantalla()
    await screen.findByText('Mostrando 2 de 5')
    await userEvent.type(screen.getByLabelText('Buscar'), 'saph')
    expect(ultimaConsulta().get('SearchTerm')).toBeNull()
    await waitFor(() => expect(ultimaConsulta().get('SearchTerm')).toBe('saph'))
    const conBusqueda = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('SearchTerm='))
    expect(conBusqueda.every((u) => u.includes('SearchTerm=saph'))).toBe(true)
  })

  it('Borradores muestra los del usuario que devuelve el servidor y se retoman al tocarlos', async () => {
    pantalla()
    await userEvent.press(screen.getByRole('tab', { name: 'Borradores' }))
    expect(await screen.findByText('Gorrión Mayorista')).toBeTruthy()
    expect(screen.getByText(/3 líneas · Guardado hoy/)).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Compras/borradores/mios')
    // Tocar un borrador lo retoma en la compra nueva.
    await userEvent.press(screen.getByRole('button', { name: /Gorrión Mayorista/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/nueva?borrador=b1')
  })

  it('en el teléfono tocar una tarjeta abre el detalle y el "+" de la lista es uno solo', async () => {
    pantalla(390)
    await userEvent.press(await screen.findByRole('button', { name: /BBBB2222/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/bbbb2222-0000-0000-0000-000000000000')
    expect(screen.getAllByLabelText('Nueva compra')).toHaveLength(1)
    expect(screen.queryByLabelText('Nueva venta')).toBeNull()
  })

  it('en tablet horizontal el detalle se abre al costado, sin salir de la lista', async () => {
    pantalla(1200)
    expect(await screen.findByText('Elegí una compra para ver el detalle.')).toBeTruthy()
    await userEvent.press(await screen.findByRole('button', { name: /BBBB2222/ }))
    expect(within(screen.getByTestId('two-pane-detail')).getByText('detalle bbbb2222-0000-0000-0000-000000000000')).toBeTruthy()
    expect(within(screen.getByTestId('two-pane-list')).getByRole('button', { name: /AAAA1111/ })).toBeTruthy()
    expect(screen.getAllByLabelText('Nueva compra')).toHaveLength(1)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
