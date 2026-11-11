import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { themeColors, useThemeStore } from '@/libs/theme'
import { PreparacionScreen } from '../PreparacionScreen'

const mockGet = jest.fn()
const mockEscritura = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: {
    get: (url: string) => mockGet(url),
    post: (...a: unknown[]) => mockEscritura('post', ...a),
    put: (...a: unknown[]) => mockEscritura('put', ...a),
    patch: (...a: unknown[]) => mockEscritura('patch', ...a),
    delete: (...a: unknown[]) => mockEscritura('delete', ...a),
  },
}))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useIsFocused: () => true,
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => {
    const w = mockAncho()
    return { width: w, height: 800, isLarge: w >= 600, isTablet: w >= 600, isTabletLandscape: w >= 900, scale: (n: number) => n }
  },
}))

const pedido = (o: Record<string, unknown>) => ({
  vendedorNombre: 'Emanuel Parraquini', metodoEntrega: 1, metodoEntregaNombre: 'LogisticaPropia',
  fechaEntrega: '2026-10-09T13:00:00Z', version: 1, piezasCount: 0, itemsCount: 1, unidadesCount: 0, ...o,
})
// Hoy es viernes 9 de octubre en Argentina.
const PEDIDOS = [
  pedido({ id: 'v1', codigoPedido: 'A00417', direccion: 'Juan B. Justo 6376', clienteNombre: 'Autoservicio Carlos', estado: 2, itemsCount: 12, unidadesCount: 48, fechaEntrega: '2026-10-05T13:00:00Z' }),
  pedido({ id: 'v2', codigoPedido: 'A00424', direccion: 'Brandsen 3314', clienteNombre: 'Perfumería Sofía', estado: 2, itemsCount: 3, unidadesCount: 20, metodoEntrega: 2, metodoEntregaNombre: 'RetiroEnLocal' }),
  pedido({ id: 'v3', codigoPedido: 'A00430', direccion: 'Gaona 1200', clienteNombre: 'Almacén Rita', estado: 3, itemsCount: 5, unidadesCount: 36, ultimoCambioPor: 'Operario Uno', ultimoCambioEn: '2026-10-09T13:42:00Z' }),
  pedido({ id: 'v4', codigoPedido: 'A00431', direccion: 'Corrientes 900', clienteNombre: 'Kiosco Leo', estado: 4, piezasCount: 3, hojaRutaId: 'h1', hojaRutaCodigo: 'HR-0042' }),
  pedido({ id: 'v5', codigoPedido: 'A00432', direccion: 'Rivadavia 50', clienteNombre: 'Super Ana', estado: 4, piezasCount: 2, metodoEntrega: 3, metodoEntregaNombre: 'Expreso' }),
  pedido({ id: 'v6', codigoPedido: 'A00399', direccion: 'Tarantino 1898', clienteNombre: 'Abel', estado: 7, fechaEntrega: '2026-10-07T13:00:00Z' }),
]
const CONTEOS = { columnas: [
  { clave: 'Confirmada', cantidad: 12 }, { clave: 'EnPreparacion', cantidad: 5 },
  { clave: 'Empacada', cantidad: 3 }, { clave: 'NoEntregada', cantidad: 4 },
] }

let pedidos: unknown[] = PEDIDOS
function servidor() {
  mockGet.mockImplementation((url: string) =>
    url.includes('preparacion/conteos') ? Promise.resolve(CONTEOS)
      : url.includes('ventas-para-preparacion') ? Promise.resolve(pedidos)
      : url.endsWith('/api/v1/Depositos') ? Promise.resolve([{ id: 'd1', nombre: 'Depósito Central' }, { id: 'd2', nombre: 'Zona Norte' }])
      : url.endsWith('/Ventas/vendedores') ? Promise.resolve([{ id: 'u1', nombre: 'Emanuel Parraquini' }, { id: 'u2', nombre: 'Lucía Ferreyra' }])
      : url.endsWith('/Ventas/v1') ? Promise.resolve({ venta: { id: 'v1' }, detalles: [{ id: 'd1', productoNombre: 'Lavandina Ayudín Clásica 2 L', cantidad: 60 }], bultos: [] })
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
}

const permisos = (...p: { module: string; canRead?: boolean; canCreate?: boolean }[]) =>
  useAuthStore.setState({ user: { id: 'u9', username: 'ramiro', roles: [], depositoId: 'd1', permissions: p } } as never)

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PreparacionScreen /></QueryClientProvider>)
}
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean))
const urls = () => mockGet.mock.calls.map(([u]) => String(u))
const pedidosPedidos = () => urls().filter((u) => u.includes('ventas-para-preparacion'))
const ultimaLista = () => pedidosPedidos().at(-1)!

beforeEach(() => {
  jest.clearAllMocks()
  pedidos = PEDIDOS
  mockAncho.mockReturnValue(390)
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
  permisos({ module: 'MOD_VIAJES', canRead: true }, { module: 'MOD_VENTAS', canRead: true })
  servidor()
})
afterEach(() => { jest.restoreAllMocks() })

describe.each(['light', 'dark'] as const)('Preparación de pedidos (%s)', (esquema) => {
  const c = themeColors[esquema]
  beforeEach(() => useThemeStore.setState({ mode: esquema }))

  it('cuatro pestañas en dos filas de dos, con la cantidad que cuenta el servidor', async () => {
    pintar()
    expect(await screen.findByRole('tab', { name: 'A preparar: 12 pedidos' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'En preparación: 5 pedidos' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Empacados: 3 pedidos' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'No entregado: 4 pedidos' })).toBeTruthy()
    const filas = screen.getAllByTestId('fila-pestanas')
    expect(filas).toHaveLength(2)
    for (const f of filas) expect(within(f).getAllByRole('tab')).toHaveLength(2)
    const activa = screen.getByRole('tab', { name: 'A preparar: 12 pedidos' })
    expect(activa.props.accessibilityState).toMatchObject({ selected: true })
    // La elegida toma el color de su columna (ámbar, como "por autorizar").
    expect(flat(activa.props.style).borderColor).toBe(c.chip.porAutorizar.text)
  })

  it('cada columna lleva su subtotal y su cantidad: unidades, piezas o "Hay que reprogramar"', async () => {
    pintar()
    const cabecera = await screen.findByTestId('cabecera-aPreparar')
    expect(within(cabecera).getByText('A preparar')).toBeTruthy()
    expect(within(cabecera).getByText('68 unidades')).toBeTruthy()
    expect(within(cabecera).getByLabelText('2 pedidos')).toBeTruthy()
    await userEvent.press(screen.getByRole('tab', { name: 'En preparación: 5 pedidos' }))
    expect(within(screen.getByTestId('cabecera-enPreparacion')).getByText('36 unidades')).toBeTruthy()
    await userEvent.press(screen.getByRole('tab', { name: 'Empacados: 3 pedidos' }))
    expect(within(screen.getByTestId('cabecera-empacados')).getByText('5 piezas')).toBeTruthy()
    await userEvent.press(screen.getByRole('tab', { name: 'No entregado: 4 pedidos' }))
    const fallidos = screen.getByTestId('cabecera-noEntregado')
    expect(within(fallidos).getByText('Hay que reprogramar')).toBeTruthy()
    expect(within(fallidos).getByLabelText('1 pedido')).toBeTruthy()
  })

  it('la tarjeta es la de la web: código, Atrasado, método, dirección, cliente, entrega y vendedor', async () => {
    pintar()
    const atrasada = await screen.findByTestId('tarjeta-v1')
    expect(within(atrasada).getByText('A00417')).toBeTruthy()
    expect(within(atrasada).getByText('Atrasado')).toBeTruthy()
    expect(within(atrasada).getByText('Logística')).toBeTruthy()
    expect(within(atrasada).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(atrasada).getByText('Autoservicio Carlos')).toBeTruthy()
    expect(within(atrasada).getByText('Entrega lun 5/10')).toBeTruthy()
    expect(within(atrasada).getByText('Emanuel Parraquini')).toBeTruthy()
    const deHoy = screen.getByTestId('tarjeta-v2')
    expect(within(deHoy).queryByText('Atrasado')).toBeNull()
    expect(within(deHoy).getByText('Retiro')).toBeTruthy()

    await userEvent.press(screen.getByRole('tab', { name: 'En preparación: 5 pedidos' }))
    const enCurso = screen.getByTestId('tarjeta-v3')
    expect(within(enCurso).getByText('5 ítems · 36 unidades')).toBeTruthy()
    expect(within(enCurso).getByText('Operario Uno · 09/10 10:42')).toBeTruthy()

    await userEvent.press(screen.getByRole('tab', { name: 'Empacados: 3 pedidos' }))
    const empacado = screen.getByTestId('tarjeta-v4')
    expect(within(empacado).getByText('En hoja HR-0042')).toBeTruthy()
    expect(within(empacado).getByText('3 piezas')).toBeTruthy()
    expect(within(screen.getByTestId('tarjeta-v5')).getByText('Expreso')).toBeTruthy()

    await userEvent.press(screen.getByRole('tab', { name: 'No entregado: 4 pedidos' }))
    const fallida = screen.getByTestId('tarjeta-v6')
    expect(within(fallida).getByText('Entrega fallida mié 7/10')).toBeTruthy()
    // La fecha ya es la fallida: no se marca atrasado.
    expect(within(fallida).queryByText('Atrasado')).toBeNull()
  })

  it('solo para ver: sin casillas ni botones que cambien datos, y nunca escribe en el servidor', async () => {
    pintar()
    await screen.findByTestId('tarjeta-v1')
    for (const tab of ['A preparar: 12 pedidos', 'En preparación: 5 pedidos', 'Empacados: 3 pedidos', 'No entregado: 4 pedidos']) {
      await userEvent.press(screen.getByRole('tab', { name: tab }))
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
      for (const accion of [/^Preparar/, /Marcar preparado/, /^Volver/, /Ajustar/, /Etiquetas/, /Confirmar retiro/, /Despachar/, /Reprogramar$/, /Empacar/]) {
        expect(screen.queryByRole('button', { name: accion })).toBeNull()
        expect(screen.queryByText(accion)).toBeNull()
      }
    }
    expect(screen.getByText('Desde el teléfono solo se ven. Reprogramar o anular se hace en la web.')).toBeTruthy()
    expect(mockEscritura).not.toHaveBeenCalled()
  })

  it('arranca en Hoy y los atajos cambian el rango que se pide', async () => {
    pintar()
    await screen.findByTestId('tarjeta-v1')
    expect(screen.getByRole('button', { name: 'Hoy' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(ultimaLista()).toContain('FechaDesde=2026-10-09&FechaHasta=2026-10-09')
    await userEvent.press(screen.getByRole('button', { name: 'Mañana' }))
    expect(ultimaLista()).toContain('FechaDesde=2026-10-10&FechaHasta=2026-10-10')
    await userEvent.press(screen.getByRole('button', { name: 'Esta semana' }))
    expect(ultimaLista()).toContain('FechaDesde=2026-10-09&FechaHasta=2026-10-15')
    await userEvent.press(screen.getByRole('button', { name: 'Todo' }))
    expect(ultimaLista()).not.toContain('FechaDesde')
    expect(ultimaLista()).not.toContain('FechaHasta')
  })

  it('la hoja de filtros filtra por rango exacto, método y vendedor, y Limpiar vuelve a como abrió', async () => {
    pintar()
    await screen.findByTestId('tarjeta-v1')
    await userEvent.press(screen.getByRole('button', { name: 'Filtros: rango exacto, método de entrega y vendedor' }))
    const hoja = () => within(screen.getByTestId('hoja-filtros'))
    await userEvent.press(hoja().getByRole('button', { name: 'Rango exacto' }))
    await userEvent.press(within(hoja().getByTestId('rango-hasta')).getByRole('button', { name: 'Día siguiente' }))
    await userEvent.press(hoja().getByRole('button', { name: 'Retiro' }))
    await userEvent.press(await hoja().findByRole('button', { name: 'Lucía Ferreyra' }))
    const pedida = ultimaLista()
    expect(pedida).toContain('FechaDesde=2026-10-09&FechaHasta=2026-10-10')
    expect(pedida).toContain('MetodoEntrega=2')
    expect(pedida).toContain('VendedorId=u2')
    expect(urls().filter((u) => u.includes('preparacion/conteos')).at(-1)).toContain('MetodoEntrega=2')
    await userEvent.press(hoja().getByRole('button', { name: 'Limpiar' }))
    // Vuelve a como abrió: Hoy, todos los métodos y todos los vendedores (lo sirve lo ya pedido).
    const elegido = (name: string) => hoja().getByRole('button', { name }).props.accessibilityState.selected
    expect(elegido('Hoy')).toBe(true)
    expect(elegido('Todos')).toBe(true)
    expect(elegido('Todos los vendedores del depósito')).toBe(true)
    expect(hoja().queryByTestId('rango-desde')).toBeNull()
  })

  it('el depósito asignado al usuario va fijo, con candado, y no viaja: lo recorta el servidor', async () => {
    pintar()
    expect(await screen.findByText('Depósito Central')).toBeTruthy()
    expect(screen.getByText('asignado a tu usuario')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Depósito/ })).toBeNull()
    expect(pedidosPedidos().every((u) => !u.includes('DepositoId'))).toBe(true)
  })

  it('quien ve todos los depósitos ve "Todos los depósitos", sin candado', async () => {
    permisos({ module: 'MOD_VIAJES', canRead: true }, { module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true })
    pintar()
    expect(await screen.findByText('Todos los depósitos')).toBeTruthy()
    expect(screen.queryByText('asignado a tu usuario')).toBeNull()
  })

  it('cargando, error con Reintentar, sin pedidos con Ver todo y Limpiar filtros, y columna vacía', async () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    const { unmount } = pintar()
    expect(screen.getByLabelText('Cargando el tablero de preparación')).toBeTruthy()
    unmount()

    servidor()
    const servido = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url.includes('ventas-para-preparacion') ? Promise.reject(new Error('500')) : servido(url)))
    const e = pintar()
    expect(await screen.findByText('No pudimos cargar el tablero de preparación')).toBeTruthy()
    expect(screen.getByText(/Revisá tu conexión y probá de nuevo\. Si sigue igual, avisale a Sistemas\./)).toBeTruthy()
    const antes = pedidosPedidos().length
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(pedidosPedidos().length).toBeGreaterThan(antes)
    e.unmount()

    servidor()
    pedidos = []
    pintar()
    expect(await screen.findByText('No hay pedidos para preparar')).toBeTruthy()
    expect(screen.getByText('No encontramos pedidos de Depósito Central con estos filtros. Probá con otro día o mirá todo lo pendiente.')).toBeTruthy()
    // Abrió como siempre: no hay filtros que limpiar.
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Mañana' }))
    expect(await screen.findByRole('button', { name: 'Limpiar filtros' })).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Ver todo' }))
    expect(ultimaLista()).not.toContain('FechaDesde')
    expect(screen.queryByRole('button', { name: 'Ver todo' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Limpiar filtros' }))
    // Vuelve a Hoy (la respuesta ya pedida la sirve el caché): no queda nada que limpiar.
    expect(screen.getByRole('button', { name: 'Hoy' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })

  it.each([
    ['En preparación', 'Ningún pedido en preparación.'],
    ['Empacados', 'Todavía no hay pedidos empacados.'],
    ['No entregado', 'No hay entregas fallidas. Buen trabajo.'],
  ])('columna %s vacía: "%s"', async (columna, texto) => {
    pedidos = [PEDIDOS[0]]
    pintar()
    await screen.findByTestId('tarjeta-v1')
    await userEvent.press(screen.getByRole('tab', { name: new RegExp(`^${columna}`) }))
    expect(screen.getByText(texto)).toBeTruthy()
  })

  it('sin el módulo de Viajes no pide nada y dice por qué', () => {
    permisos({ module: 'MOD_VENTAS', canRead: true })
    pintar()
    expect(screen.getByText('No tenés acceso a Preparación de pedidos')).toBeTruthy()
    expect(screen.getByText('Tu usuario no tiene el módulo de Viajes. Pedile a quien administra tu cuenta que te lo habilite.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('sin señal y sin nada guardado lo dice con Reintentar', async () => {
    const servido = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url.includes('ventas-para-preparacion') ? Promise.reject(new TypeError('Network request failed')) : servido(url)))
    pintar()
    expect(await screen.findByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('tocar una tarjeta abre el detalle del pedido y Atrás vuelve al tablero', async () => {
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Pedido A00417: Juan B. Justo 6376' }))
    expect(await screen.findByText('Lavandina Ayudín Clásica 2 L')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(screen.getByTestId('tarjeta-v1')).toBeTruthy()
  })

  it('en una tablet de 900 px o más van las cuatro columnas lado a lado, sin pestañas', async () => {
    mockAncho.mockReturnValue(1024)
    pintar()
    await screen.findByTestId('tarjeta-v1')
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    for (const id of ['aPreparar', 'enPreparacion', 'empacados', 'noEntregado']) expect(screen.getByTestId(`cabecera-${id}`)).toBeTruthy()
    for (const id of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) expect(screen.getByTestId(`tarjeta-${id}`)).toBeTruthy()
  })

  it('en una tablet de menos de 900 px siguen las pestañas', async () => {
    mockAncho.mockReturnValue(800)
    pintar()
    await screen.findByTestId('tarjeta-v1')
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.queryByTestId('cabecera-empacados')).toBeNull()
  })
})
