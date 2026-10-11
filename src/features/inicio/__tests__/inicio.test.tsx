import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { InicioScreen } from '../components/InicioScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))

const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), height: 800, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n }),
}))

const VENTA_HOY = {
  id: 'v1',
  codigoPedido: 'A00418',
  vendedorNombre: 'Emanuel Parraquini',
  direccionCliente: 'Juan B. Justo 6376',
  displayNameCliente: 'Carlos',
  fecha: '2026-10-07T13:03:00Z',
  estado: 'Confirmada',
  tipoOperacion: 2,
  totalAmount: 214560,
}

type Respuestas = Partial<Record<'presupuestos' | 'pedidos' | 'porAutorizar' | 'compras' | 'hoy', unknown>>

/** Responde según la URL, como el servidor. Una clave ausente = la llamada falla. */
function servidor(r: Respuestas) {
  mockGet.mockImplementation((url: string) => {
    const clave = url.includes('pendientes-autorizacion') ? 'porAutorizar'
      : url.includes('Compras/resumen') ? 'compras'
      : url.includes('fechaDesde') ? 'hoy'
      : url.includes('tipoOperacion=1') ? 'presupuestos'
      : url.includes('tipoOperacion=2') ? 'pedidos'
      : 'otro'
    const valor = (r as Record<string, unknown>)[clave]
    return valor === undefined ? Promise.reject(new Error(`sin respuesta: ${url}`)) : Promise.resolve(valor)
  })
}

const pagina = (totalCount: number, items: unknown[] = [{ id: 'x' }]) => ({ items, totalCount, page: 1, pageSize: 1, totalPages: totalCount, hasNextPage: totalCount > 1 })

function conPermisos(...modulos: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'Parraquini', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) },
  } as never)
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <InicioScreen />
    </QueryClientProvider>,
  )
}

const flat = (el: { props: { style?: unknown } }): ViewStyle => StyleSheet.flatten(el.props.style as StyleProp<ViewStyle>) ?? {}

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
})

describe('Inicio: tarjetas de pendientes', () => {
  it('los números salen del totalCount y del resumen del servidor, no de las filas recibidas', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({
      presupuestos: pagina(12),
      pedidos: pagina(5),
      porAutorizar: [{ id: 'a' }, { id: 'b' }],
      compras: { totalComprado: 1, notasPedido: 3, confirmadas: 2, entregadas: 40, canceladas: 0, anuladas: 0 },
      hoy: pagina(0, []),
    })
    pintar()

    expect(await screen.findByLabelText('Presupuestos: 12')).toBeTruthy()
    expect(await screen.findByLabelText('Pedidos confirmados: 5')).toBeTruthy()
    expect(await screen.findByLabelText('Por autorizar: 2')).toBeTruthy()
    expect(await screen.findByLabelText('Notas de pedido: 3')).toBeTruthy()
    expect(await screen.findByLabelText('Por recibir: 2')).toBeTruthy()
    // Los filtros que cuentan: Presupuesto+Pendiente y Pedido+Confirmada.
    const urls = mockGet.mock.calls.map(([u]) => u as string)
    expect(urls.some((u) => u.includes('tipoOperacion=1') && u.includes('estado=Pendiente'))).toBe(true)
    expect(urls.some((u) => u.includes('tipoOperacion=2') && u.includes('estado=Confirmada'))).toBe(true)
  })

  it('sin dato del servidor la fila muestra "—", nunca 0', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ presupuestos: pagina(7), pedidos: pagina(1), hoy: pagina(0, []) }) // compras falla
    pintar()

    await screen.findByLabelText('Presupuestos: 7')
    const fila = await screen.findByLabelText('Notas de pedido: sin dato')
    expect(within(fila).getByText('—')).toBeTruthy()
    expect(within(fila).queryByText('0')).toBeNull()
    expect(screen.getByLabelText('Por recibir: sin dato')).toBeTruthy()
  })

  it('"Por autorizar" no aparece ni se pide sin CAP_AUTORIZAR_VENTA', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), porAutorizar: [{ id: 'a' }], hoy: pagina(0, []) })
    pintar()

    await screen.findByLabelText('Presupuestos: 1')
    expect(screen.queryByLabelText(/Por autorizar/)).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('pendientes-autorizacion'))).toBe(false)
    // Sin MOD_COMPRAS tampoco hay tarjeta de Compras.
    expect(screen.queryByLabelText('Compras pendientes')).toBeNull()
  })

  it('cada fila lleva a su lista', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), porAutorizar: [{ id: 'a' }], compras: { notasPedido: 1, confirmadas: 1 }, hoy: pagina(0, []) })
    pintar()
    const user = userEvent.setup()

    await user.press(await screen.findByLabelText('Presupuestos: 1'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas')
    await user.press(await screen.findByLabelText('Por recibir: 1'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/compras')
    await user.press(await screen.findByLabelText('Por autorizar: 1'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/autorizaciones')
  })
})

describe('Inicio: Reciente · Hoy', () => {
  it('usa la dirección como título y el nombre en su propia línea', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(1, [VENTA_HOY]) })
    pintar()

    const tarjeta = await screen.findByLabelText(/^Pedido A00418 · Emanuel Parraquini/)
    expect(within(tarjeta).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(tarjeta).getByText('Carlos')).toBeTruthy()
    expect(within(tarjeta).queryByText(/Juan B\. Justo 6376.*Carlos/)).toBeNull()
  })

  it('si la consulta de hoy falla muestra un error con "Reintentar", no un día vacío', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(0), pedidos: pagina(0) }) // hoy falla
    pintar()

    expect(await screen.findByText('No se pudieron cargar las ventas de hoy')).toBeTruthy()
    expect(screen.queryByText('Todavía no hay ventas hoy.')).toBeNull()

    servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(0, []) })
    const user = userEvent.setup()
    await user.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Todavía no hay ventas hoy.')).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar las ventas de hoy')).toBeNull()
  })

  it('un día vacío con éxito dice que no hay ventas', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(0, []) })
    pintar()
    expect(await screen.findByText('Todavía no hay ventas hoy.')).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar las ventas de hoy')).toBeNull()
  })

  it('"hoy" es el día argentino aunque el teléfono esté en UTC (01:30Z = 10-10 en Argentina)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-11T01:30:00Z'), doNotFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] })
    try {
      conPermisos('MOD_VENTAS')
      servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(0, []) })
      pintar()
      await screen.findByText('Todavía no hay ventas hoy.')

      const url = mockGet.mock.calls.map(([u]) => String(u)).find((u) => u.includes('fechaDesde')) ?? ''
      expect(url).toContain('fechaDesde=2026-10-10')
      expect(url).toContain('fechaHasta=2026-10-10')
      expect(screen.getByText('Sábado 10 de octubre')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('con la pantalla abierta al cruzar la medianoche argentina pasa al día siguiente y lo pide', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-11T02:59:00Z'), doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'] }) // 23:59 ART del 10-10
    try {
      conPermisos('MOD_VENTAS')
      servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(0, []) })
      pintar()
      await jest.advanceTimersByTimeAsync(0)
      expect(screen.getByText('Sábado 10 de octubre')).toBeTruthy()

      await jest.advanceTimersByTimeAsync(61_000)
      await jest.advanceTimersByTimeAsync(100)

      expect(screen.getByText('Domingo 11 de octubre')).toBeTruthy()
      const urls = mockGet.mock.calls.map(([u]) => String(u))
      expect(urls.some((u) => u.includes('fechaDesde=2026-10-11') && u.includes('fechaHasta=2026-10-11'))).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('la hora de la tarjeta se muestra en hora argentina', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(0), pedidos: pagina(0), hoy: pagina(1, [VENTA_HOY]) }) // 13:03Z
    pintar()
    const tarjeta = await screen.findByLabelText(/^Pedido A00418/)
    expect(within(tarjeta).getByText('10:03')).toBeTruthy()
  })
})

describe('Inicio: tablet', () => {
  beforeEach(() => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), compras: { notasPedido: 1, confirmadas: 1 }, hoy: pagina(0, []) })
  })

  it('con ancho ≥ 900 las tarjetas van en fila y se reparten el ancho', async () => {
    mockAncho.mockReturnValue(900)
    pintar()
    await screen.findByLabelText('Presupuestos: 1')

    expect(screen.getByTestId('inicio-pendientes').props.horizontal).toBeFalsy()
    expect(flat(screen.getByTestId('inicio-pendientes')).flexDirection).toBe('row')
    expect(flat(screen.getByLabelText('Ventas pendientes')).flex).toBe(1)
    expect(flat(screen.getByLabelText('Compras pendientes')).flex).toBe(1)
  })

  it('en teléfono se deslizan con ancho fijo', async () => {
    pintar()
    await screen.findByLabelText('Presupuestos: 1')

    expect(screen.getByTestId('inicio-pendientes').props.horizontal).toBe(true)
    expect(flat(screen.getByLabelText('Ventas pendientes')).width).toBe(240)
  })
})
