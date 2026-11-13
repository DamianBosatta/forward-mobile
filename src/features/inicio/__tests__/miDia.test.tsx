import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { crearQueryClient } from '@/core/query/queryClient'
import { guardarReciente } from '@/features/clientes/lib/recientes'
import { MiDiaScreen } from '../components/MiDiaScreen'
import { varianteDeInicio } from '../lib/varianteDeInicio'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string, o?: unknown) => (o === undefined ? mockGet(url) : mockGet(url, o)) },
}))
const { ApiError } = jest.requireActual('@/core/api/client')


const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-router/react-navigation', () => ({
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
    if (url.includes('Dashboard/summary')) return Promise.resolve(extra.dashboard ?? { salesToday: 1284500 })
    if (url.includes('/Ventas?')) return Promise.resolve({ items: [], totalCount: 3, pageNumber: 1, pageSize: 1 })
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
  useAuthStore.setState({
    user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: true }] },
  } as never)
  responder()
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-17T15:00:00Z').getTime())
})
afterEach(() => jest.restoreAllMocks())

describe('varianteDeInicio (como la web: CAP_VER_COSTOS decide, no el rol)', () => {
  it('el chofer sigue yendo a su consola', () => expect(varianteDeInicio({ esChofer: true, veCostos: true })).toBe('chofer'))
  it('con CAP_VER_COSTOS, el de gestión', () => expect(varianteDeInicio({ esChofer: false, veCostos: true })).toBe('gestion'))
  it('sin CAP_VER_COSTOS, Mi día del vendedor', () => expect(varianteDeInicio({ esChofer: false, veCostos: false })).toBe('vendedor'))
  it('quien no vende y maneja stock o compras, el de depósito; con CAP_VER_COSTOS gana gestión y el chofer su consola', () => {
    expect(varianteDeInicio({ esChofer: false, veCostos: false, esDeposito: true })).toBe('deposito')
    expect(varianteDeInicio({ esChofer: false, veCostos: true, esDeposito: true })).toBe('gestion')
    expect(varianteDeInicio({ esChofer: true, veCostos: false, esDeposito: true })).toBe('chofer')
  })
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
    // Cobros y clientes: la tarjeta Deudores sale de cobrosPendientes (el vendedor no tiene MOD_PAGOS).
    expect(await screen.findByText('4 clientes te deben')).toBeTruthy()
    expect(screen.getByTestId('deudores-monto').props.children).toBe(ars('640.300,00'))
    const url = mockGet.mock.calls.map(([u]) => String(u)).find((u) => u.includes('resumen-vendedor'))!
    expect(url).toContain('anio=2026&mes=10')
  })

  it('la barra de Mi día muestra la marca FWD (propuesta de Inicio, frame Mi día)', async () => {
    pintar()
    expect(await screen.findByText(ars('3.420.000,00'))).toBeTruthy()
    expect(screen.getByTestId('logo-fwd', { includeHiddenElements: true })).toBeTruthy()
  })

  it('los tres números del mes van en una tarjeta debajo del hero, con el importe a la derecha', async () => {
    pintar()
    const cifras = await screen.findByTestId('mi-dia-cifras')
    expect(screen.getByRole('header', { name: 'Tus números de octubre' })).toBeTruthy()
    expect(within(cifras).getByLabelText(`Vendido en octubre: ${ars('3.420.000,00')}`)).toBeTruthy()
    expect(within(cifras).getByLabelText(`Tu comisión: ${ars('171.000,00')}`)).toBeTruthy()
    expect(within(cifras).queryByLabelText(/Por cobrar/)).toBeNull()
    expect(within(screen.getByTestId('mi-dia-hero')).queryByText(ars('171.000,00'))).toBeNull()
  })

  it('el hero muestra lo vendido hoy y cuántas ventas fueron, sin "Nueva venta" adentro en teléfono', async () => {
    pintar()
    const hero = await screen.findByTestId('mi-dia-hero')
    expect(within(hero).getByText('Ventas de hoy')).toBeTruthy()
    expect(within(hero).getByText(ars('1.284.500,00'))).toBeTruthy()
    expect(await within(hero).findByText('3 ventas')).toBeTruthy()
    expect(within(hero).queryByRole('button', { name: 'Nueva venta' })).toBeNull()
    expect(screen.getByRole('header', { name: 'Para resolver hoy' })).toBeTruthy()
  })

  it('sin dato de ventas de hoy el hero muestra "—", nunca 0', async () => {
    responder({ dashboard: { salesToday: null } })
    pintar()
    const hero = await screen.findByTestId('mi-dia-hero')
    expect(within(hero).getByLabelText('Ventas de hoy: —', { exact: false })).toBeTruthy()
  })

  it('con la bandeja de autorizaciones la fila la nombra como alerta', async () => {
    responder({ inicio: { ...RESUMEN_INICIO, ventas: { ...RESUMEN_INICIO.ventas, presupuestosPendientes: pend(1) }, autorizacionesPendientes: pend(4) } })
    pintar()
    expect(await screen.findByLabelText('4 pedidos por autorizar. Bandeja de autorizaciones')).toBeTruthy()
  })

  it('si las ventas de hoy fallan, el hero lo dice con "Reintentar" y no inventa una cifra', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('Dashboard/summary')) return Promise.reject(new ApiError(500, 'boom'))
      if (url.includes('Inicio/resumen')) return Promise.resolve(RESUMEN_INICIO)
      if (url.includes('resumen-vendedor')) return Promise.resolve(RESUMEN_VENDEDOR)
      return Promise.reject(new ApiError(404, 'no'))
    })
    pintar()
    expect(await screen.findByText('No se pudieron cargar las ventas de hoy.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar ventas de hoy' })).toBeTruthy()
    expect(screen.queryByTestId('mi-dia-hero')).toBeNull()
  })

  it('mientras cargan los números muestra bloques con la forma del hero, no la ruedita ni "Cargando…"', async () => {
    mockGet.mockImplementation((url: string) => (url.includes('resumen-vendedor') ? new Promise(() => {}) : Promise.resolve(RESUMEN_INICIO)))
    pintar()
    expect(await screen.findByTestId('hero-cargando')).toBeTruthy()
    expect(screen.queryByText('Cargando…')).toBeNull()
    expect(screen.queryByLabelText('Cargando tus números')).toBeNull()
  })

  it('si los pendientes fallan, lo dice en su sección con "Reintentar" y el hero muestra "—", nunca un 0', async () => {
    mockGet.mockImplementation((url: string) =>
      url.includes('Inicio/resumen') ? Promise.reject(new ApiError(500, 'boom')) : Promise.resolve(RESUMEN_VENDEDOR))
    pintar()
    expect(await screen.findByText('No se pudieron cargar los pendientes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar pendientes' })).toBeTruthy()
    expect(within(screen.getByTestId('mi-dia-hero')).getByText('—')).toBeTruthy()
    expect(screen.queryByText(/^0 pendientes/)).toBeNull()
    expect(screen.queryByText('Todo al día.')).toBeNull()
  })

  it('sin permiso de leer Ventas no dibuja lo que no puede ver: sin hero, números ni pendientes, solo "Vender de nuevo"', async () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [] },
    } as never)
    pintar()
    expect(await screen.findByRole('header', { name: 'Vender de nuevo' })).toBeTruthy()
    expect(screen.getByText('Todavía no vendiste a ningún cliente desde acá.')).toBeTruthy()
    expect(screen.queryByTestId('mi-dia-hero')).toBeNull()
    expect(screen.queryByTestId('hero-cargando')).toBeNull()
    expect(screen.queryByText(/Tus números/)).toBeNull()
    expect(screen.queryByText('Para resolver hoy')).toBeNull()
    expect(screen.queryByText(/No se pudieron cargar/)).toBeNull()
    expect(screen.queryByText('Cargando…')).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('resumen-vendedor'))).toBe(false)
  })

  it('"Vender de nuevo" son filas de una tarjeta: iniciales, la dirección de título y el nombre abajo', async () => {
    guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Kiosco Uno' })
    pintar()
    const fila = await screen.findByTestId('reciente-c1')
    expect(within(fila).getByText('T1')).toBeTruthy()
    expect(within(fila).getByText('Tarantino 1898')).toBeTruthy()
    expect(within(fila).getByText('Kiosco Uno')).toBeTruthy()
  })

  it('"Para resolver hoy" sale de /Inicio/resumen y abre cada lista', async () => {
    pintar()
    const user = userEvent.setup()
    await user.press(await screen.findByLabelText(/3 presupuestos pendientes/))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente')
    await user.press(screen.getByLabelText(/2 pedidos esperando autorización/))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion')
  })

  it('"Para resolver hoy" suma pedidos rechazados y presupuestos por vencer del resumen del vendedor, sin navegar', async () => {
    responder({ vendedor: { ...RESUMEN_VENDEDOR, pedidosRechazados: 1, presupuestosPorVencer: 4 } })
    pintar()
    expect(await screen.findByLabelText(/^1 pedido rechazado\./)).toBeTruthy()
    expect(screen.getByLabelText(/^4 presupuestos por vencer\./)).toBeTruthy()
    expect(screen.getByText('1 pedido rechazado')).toBeTruthy()
    expect(screen.getByText('4 presupuestos por vencer')).toBeTruthy()
  })

  it('con 0 en los dos campos nuevos no hay filas nuevas', async () => {
    responder({ vendedor: { ...RESUMEN_VENDEDOR, pedidosRechazados: 0, presupuestosPorVencer: 0 } })
    pintar()
    await screen.findByText(ars('3.420.000,00'))
    expect(screen.queryByText(/rechazad/)).toBeNull()
    expect(screen.queryByText(/por vencer/)).toBeNull()
  })

  it('si el servidor no manda los campos nuevos, no muestra filas (ni 0 ni NaN)', async () => {
    pintar()
    await screen.findByText(ars('3.420.000,00'))
    expect(screen.queryByText(/rechazad/)).toBeNull()
    expect(screen.queryByText(/por vencer/)).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('sin pendientes de Inicio "Para resolver hoy" no se dibuja', async () => {
    responder({
      inicio: { ventas: { presupuestosPendientes: pend(0), pedidosConfirmados: pend(0), porAutorizar: pend(0) }, compras: null, autorizacionesPendientes: null },
      vendedor: { ...RESUMEN_VENDEDOR, pedidosRechazados: 0, presupuestosPorVencer: 0 },
    })
    pintar()
    await screen.findByTestId('mi-dia-hero')
    await screen.findByText(ars('3.420.000,00'))
    expect(screen.queryByText('Para resolver hoy')).toBeNull()
  })

  it('si el resumen del vendedor falla, lo dice y no inventa cifras', async () => {
    responder({ vendedor: new Error('boom') })
    pintar()
    expect(await screen.findByText('No se pudieron cargar tus números del mes.')).toBeTruthy()
    expect(screen.queryByText('Tu comisión')).toBeNull()
  })

  it('"Vender de nuevo" sin permiso para crear ventas lista los recientes del teléfono y abre la ficha', async () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true }] },
    } as never)
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

    it('tocar un reciente abre la venta nueva con ese cliente', async () => {
      conVender(true)
      guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898' })
      pintar()
      await userEvent.setup().press(await screen.findByLabelText('Tarantino 1898'))
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?clienteId=c1')
    })

    it('sin permiso para crear ventas, sigue abriendo la ficha', async () => {
      conVender(false)
      guardarReciente('u1', { id: 'c1', direccion: 'Tarantino 1898' })
      pintar()
      await userEvent.setup().press(await screen.findByLabelText('Tarantino 1898'))
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })
    })
  })

  it('en teléfono "Nueva venta" no está en la pantalla: es el botón central de la barra inferior', async () => {
    pintar()
    await screen.findByTestId('mi-dia-hero')
    expect(screen.queryByLabelText('Nueva venta')).toBeNull()
  })

  it('en tablet no hay barra: "Nueva venta" va dentro del hero y abre la venta nueva', async () => {
    mockAncho.mockReturnValue(900)
    pintar()
    const hero = await screen.findByTestId('mi-dia-hero')
    await userEvent.setup().press(within(hero).getByLabelText('Nueva venta'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas/nueva')
  })

  it('sin permiso para crear ventas no ofrece "Nueva venta" ni en tablet (decisión del dueño 22-10)', async () => {
    mockAncho.mockReturnValue(900)
    useAuthStore.setState({
      user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true }] },
    } as never)
    pintar()
    await waitFor(() => expect(screen.getByText(ars('171.000,00'))).toBeTruthy())
    expect(screen.queryByLabelText('Nueva venta')).toBeNull()
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
    expect(screen.getByTestId('tarjeta-deudores')).toBeTruthy()
  })
})
