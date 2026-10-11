import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent, within } from '@testing-library/react-native'
import { PorPrepararScreen } from '../porPreparar/PorPrepararScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
let mockEnfocada = true
let mockAlEnfocar: (() => void) | undefined
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useIsFocused: () => mockEnfocada,
  useFocusEffect: (cb: () => void) => {
    mockAlEnfocar = cb
    require('react').useEffect(cb, [])
  },
}))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => {
    const w = mockAncho()
    return { width: w, height: 800, isLarge: w >= 600, isTablet: w >= 600, isTabletLandscape: w >= 900, scale: (n: number) => n }
  },
}))

const pedido = (o: Record<string, unknown>) => ({
  vendedorNombre: 'Emanuel Parraquini', metodoEntrega: 1, metodoEntregaNombre: 'Logística propia',
  fechaEntrega: '2026-10-09T13:00:00Z', version: 1, piezasCount: 0, ...o,
})
const PEDIDOS = [
  pedido({ id: 'v1', codigoPedido: 'A00417', direccion: 'Juan B. Justo 6376', clienteNombre: 'Autoservicio Carlos', estado: 3, itemsCount: 5, piezasCount: 3 }),
  pedido({ id: 'v2', codigoPedido: 'A00424', direccion: 'Brandsen 3314', clienteNombre: 'Perfumería Sofía', estado: 2, itemsCount: 3, metodoEntregaNombre: 'Retiro en el local' }),
  // El servidor manda las no entregadas siempre, sin importar el día.
  pedido({ id: 'v3', codigoPedido: 'A00399', direccion: 'Tarantino 1898', clienteNombre: 'Abel', estado: 7, itemsCount: 9, fechaEntrega: '2026-10-07T13:00:00Z' }),
]

let diasEntrega: unknown = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true }

function servidor() {
  mockGet.mockImplementation((url: string) =>
    url.includes('ventas-para-preparacion') ? Promise.resolve(PEDIDOS)
      : url.includes('dias-entrega') ? Promise.resolve(diasEntrega)
      : url.includes('feriados') ? Promise.resolve([{ id: 'f', fecha: '2026-10-12', descripcion: 'Diversidad cultural' }])
      : url.endsWith('/Ventas/v1') ? Promise.resolve({
        venta: { id: 'v1', observaciones: 'Portón negro del depósito, antes de las 12.' },
        detalles: [{ id: 'd1', productoNombre: 'Lavandina Ayudín Clásica 2 L', cantidad: 60 }],
        bultos: [],
      })
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PorPrepararScreen /></QueryClientProvider>)
}

const urls = () => mockGet.mock.calls.map(([u]) => String(u))

beforeEach(() => {
  jest.clearAllMocks()
  mockEnfocada = true
  diasEntrega = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true }
  mockAncho.mockReturnValue(390)
  // Viernes 9 de octubre, 22:30 en Argentina (ya sábado 10 en UTC).
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
  servidor()
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('Pedidos por preparar (solo lectura)', () => {
  it('pide el día argentino de hoy y lista por dirección, sin contar los no entregados en el día', async () => {
    pintar()
    const tarjeta = await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376')
    expect(within(tarjeta).getByText('Autoservicio Carlos')).toBeTruthy()
    expect(within(tarjeta).getByText('5 líneas · 3 bultos')).toBeTruthy()
    expect(within(tarjeta).getByLabelText('Estado: En preparación')).toBeTruthy()
    expect(screen.getByText('Hoy · 2 pedidos · 8 líneas')).toBeTruthy()
    expect(screen.getByText('No entregados, para reprogramar · 1')).toBeTruthy()
    expect(urls().some((u) => u.includes('FechaDesde=2026-10-09') && u.includes('FechaHasta=2026-10-09'))).toBe(true)
  })

  it('los días saltean el fin de semana, el feriado no se elige y otro día pide esa fecha', async () => {
    pintar()
    await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376')
    const feriado = await screen.findByLabelText('lun 12 · Feriado')
    expect(feriado.props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('El lun 12 es feriado: no hay entregas.')).toBeTruthy()
    expect(screen.queryByLabelText(/^sáb|^dom/)).toBeNull()
    await userEvent.press(screen.getByLabelText('mar 13'))
    expect(urls().some((u) => u.includes('FechaDesde=2026-10-13') && u.includes('FechaHasta=2026-10-13'))).toBe(true)
  })

  it('en tablet horizontal el detalle se abre al lado de la lista con lo que hay que preparar', async () => {
    mockAncho.mockReturnValue(1100)
    pintar()
    expect(await screen.findByText('Elegí un pedido para ver qué hay que preparar.')).toBeTruthy()
    await userEvent.press(await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376'))
    expect(await screen.findByText('Lavandina Ayudín Clásica 2 L')).toBeTruthy()
    expect(screen.getByText('60 u.')).toBeTruthy()
    expect(screen.getByText('Portón negro del depósito, antes de las 12.')).toBeTruthy()
    // La lista sigue a la vista.
    expect(screen.getByLabelText('Pedido A00424: Brandsen 3314')).toBeTruthy()
  })

  it('en el teléfono el detalle reemplaza la lista y Volver la trae de nuevo', async () => {
    pintar()
    await userEvent.press(await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376'))
    expect(await screen.findByText('Pedido A00417')).toBeTruthy()
    expect(screen.queryByLabelText('Pedido A00424: Brandsen 3314')).toBeNull()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(await screen.findByLabelText('Pedido A00424: Brandsen 3314')).toBeTruthy()
  })

  it('con el sábado habilitado en el servidor, el sábado aparece entre los días de entrega', async () => {
    diasEntrega = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true }
    pintar()
    expect(await screen.findByLabelText('sáb 10')).toBeTruthy()
  })

  it('al cruzar la medianoche argentina con la pantalla abierta, "hoy" pasa al día nuevo', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-10T02:59:00Z'), doNotFake: ['nextTick', 'queueMicrotask'] })
    pintar()
    expect(await screen.findByLabelText('vie 9 · Hoy')).toBeTruthy()
    await act(async () => { jest.advanceTimersByTime(61_000) })
    expect(await screen.findByLabelText('sáb 10 · Hoy')).toBeTruthy()
    expect(screen.queryByLabelText('vie 9 · Hoy')).toBeNull()
  })

  it('al volver a la pantalla recalcula el día de hoy', async () => {
    pintar()
    expect(await screen.findByLabelText('vie 9 · Hoy')).toBeTruthy()
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-13T15:00:00Z'))
    act(() => { mockAlEnfocar?.() })
    expect(await screen.findByLabelText('mar 13 · Hoy')).toBeTruthy()
  })

  it('fuera de foco no sigue consultando cada 30 segundos; enfocada sí', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-10T01:30:00Z'), doNotFake: ['nextTick', 'queueMicrotask'] })
    const pedidos = () => urls().filter((u) => u.includes('ventas-para-preparacion')).length
    mockEnfocada = false
    const { unmount } = pintar()
    await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376')
    await act(async () => { jest.advanceTimersByTime(120_000) })
    expect(pedidos()).toBe(1)
    unmount()
    mockGet.mockClear()
    mockEnfocada = true
    pintar()
    await screen.findByLabelText('Pedido A00417: Juan B. Justo 6376')
    await act(async () => { jest.advanceTimersByTime(65_000) })
    expect(pedidos()).toBeGreaterThan(1)
  })
})
