import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { crearQueryClient } from '@/core/query/queryClient'
import { guardarReciente } from '@/features/clientes/lib/recientes'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'
import { MiDiaScreen } from '../components/MiDiaScreen'
import { varianteDeInicio } from '../lib/varianteDeInicio'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string, o?: unknown) => (o === undefined ? mockGet(url) : mockGet(url, o)) },
}))
const { ApiError } = jest.requireActual('@/core/api/client')

let mockVentaNueva = false
jest.mock('@/features/ventas/lib/ventaNueva', () => ({ ...jest.requireActual('@/features/ventas/lib/ventaNueva'), useVentaNueva: () => mockVentaNueva }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useFocusEffect: jest.fn(),
}))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), height: 800, isTablet: mockAncho() >= 600, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n }),
}))

const ars = (c: string) => `$ ${c}`
const pend = (cantidad: number) => ({ cantidad, importes: [] })
const RESUMEN_INICIO = {
  ventas: { presupuestosPendientes: pend(3), pedidosConfirmados: pend(5), porAutorizar: pend(2) },
  compras: null,
  autorizacionesPendientes: null,
}
const RESUMEN_VENDEDOR = {
  anio: 2026, mes: 10, periodo: {}, puedeElegirVendedor: false,
  ventas: { facturado: 3420000, operaciones: 14, ticketPromedio: 1, cobrado: 1 },
  comisiones: { devengado: 1, reversiones: 0, neto: 171000, pagado: 0, saldoActual: 1 },
  cobrosPendientes: { total: 640300, clientes: 4, detalle: [] },
}

function responder(extra: Record<string, unknown> = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('Inicio/resumen')) return Promise.resolve(extra.inicio ?? RESUMEN_INICIO)
    if (url.includes('resumen-vendedor')) return extra.vendedor instanceof Error ? Promise.reject(extra.vendedor) : Promise.resolve(extra.vendedor ?? RESUMEN_VENDEDOR)
    return Promise.reject(new ApiError(404, 'no'))
  })
}
function pintar() {
  return render(
    <QueryClientProvider client={crearQueryClient({ retry: false })}>
      <MiDiaScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  useVentaNuevaStore.setState({ activa: false } as never)
  mockVentaNueva = false
  useAuthStore.setState({
    user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true }] },
  } as never)
  responder()
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-17T15:00:00Z').getTime())
})
afterEach(() => jest.restoreAllMocks())

describe('varianteDeInicio (como la web: CAP_VER_COSTOS decide, no el rol)', () => {
  it('el chofer sigue yendo a su consola', () => expect(varianteDeInicio({ esChofer: true, veCostos: true })).toBe('chofer'))
  it('con CAP_VER_COSTOS, el de gestión', () => expect(varianteDeInicio({ esChofer: false, veCostos: true })).toBe('gestion'))
  it('sin CAP_VER_COSTOS, Mi día del vendedor', () => expect(varianteDeInicio({ esChofer: false, veCostos: false })).toBe('vendedor'))
})

describe('MiDiaScreen', () => {
  it('muestra la fecha argentina, el saludo y las tres cifras del servidor', async () => {
    pintar()
    expect(screen.getByText('Sábado 17 de octubre')).toBeTruthy()
    expect(screen.getByText('Hola, Emanuel')).toBeTruthy()
    expect(await screen.findByText(ars('3.420.000,00'))).toBeTruthy()
    expect(screen.getByText('Vendido en octubre')).toBeTruthy()
    expect(screen.getByText('Tu comisión')).toBeTruthy()
    expect(screen.getByText(ars('171.000,00'))).toBeTruthy()
    expect(screen.getByText('Por cobrar')).toBeTruthy()
    expect(screen.getByText(ars('640.300,00'))).toBeTruthy()
    const url = mockGet.mock.calls.map(([u]) => String(u)).find((u) => u.includes('resumen-vendedor'))!
    expect(url).toContain('anio=2026&mes=10')
  })

  it('"Para resolver hoy" sale de /Inicio/resumen y abre cada lista', async () => {
    pintar()
    const user = userEvent.setup()
    await user.press(await screen.findByLabelText(/3 presupuestos pendientes/))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente')
    await user.press(screen.getByLabelText(/2 pedidos esperando autorización/))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion')
  })

  it('si el resumen del vendedor falla, lo dice y no inventa cifras', async () => {
    responder({ vendedor: new Error('boom') })
    pintar()
    expect(await screen.findByText('No se pudieron cargar tus números del mes.')).toBeTruthy()
    expect(screen.queryByText('Tu comisión')).toBeNull()
  })

  it('"Vender de nuevo" lista los recientes del teléfono y abre la ficha', async () => {
    guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898' })
    pintar()
    const user = userEvent.setup()
    await user.press(await screen.findByLabelText('Tarantino 1898'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })
    await user.press(screen.getByLabelText('Todos los clientes'))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/socios')
  })

  describe('Vender de nuevo con el cliente elegido (T4c)', () => {
    const conVender = (create: boolean) => useAuthStore.setState({
      user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: create }] },
    } as never)

    it('con la venta nueva prendida, tocar un reciente abre la venta nueva con ese cliente', async () => {
      mockVentaNueva = true
      conVender(true)
      guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898' })
      pintar()
      await userEvent.setup().press(await screen.findByLabelText('Tarantino 1898'))
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva-v2?clienteId=c1')
    })

    it('con la venta nueva prendida pero sin permiso para crear ventas, sigue abriendo la ficha', async () => {
      mockVentaNueva = true
      conVender(false)
      guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898' })
      pintar()
      await userEvent.setup().press(await screen.findByLabelText('Tarantino 1898'))
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })
    })
  })

  it('"Nueva venta" abre la venta de hoy, o la nueva con el switch prendido', async () => {
    pintar()
    const user = userEvent.setup()
    await user.press(screen.getByLabelText('Nueva venta'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas/nueva')
  })

  it('ofrece Buscar en el encabezado', async () => {
    pintar()
    const user = userEvent.setup()
    await user.press(screen.getByLabelText('Buscar'))
    expect(mockPush).toHaveBeenCalledWith('/buscar')
  })

  it('en tablet muestra lo mismo', async () => {
    mockAncho.mockReturnValue(900)
    pintar()
    await waitFor(() => expect(screen.getByText(ars('171.000,00'))).toBeTruthy())
    expect(screen.getByLabelText('Nueva venta')).toBeTruthy()
  })
})
