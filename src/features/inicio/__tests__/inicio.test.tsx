import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useAnularVenta, useAutorizarVenta, ventasKeys } from '@/libs/api-client/ventas'
import { useCreateCompra } from '@/features/compras/api/queries'
import { crearQueryClient } from '@/core/query/queryClient'
import { InicioScreen } from '../components/InicioScreen'

const mockGet = jest.fn()
const mockEscribir = jest.fn((_url: string) => Promise.resolve({}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: {
    get: (url: string, opciones?: unknown) => (opciones === undefined ? mockGet(url) : mockGet(url, opciones)),
    post: (url: string) => mockEscribir(url),
    delete: (url: string) => mockEscribir(url),
  },
}))
const { ApiError } = jest.requireActual('@/core/api/client')

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

type Respuestas = Partial<Record<'resumen' | 'presupuestos' | 'pedidos' | 'porAutorizar' | 'compras' | 'hoy' | 'deudas' | 'dashboard', unknown>>

/**
 * Responde según la URL, como el servidor. Un Error = la llamada falla con ese error. Sin `resumen`
 * es el servidor viejo: GET /Inicio/resumen da 404. Cualquier otra clave ausente = la llamada falla.
 */
function servidor(r: Respuestas) {
  mockGet.mockImplementation((url: string) => {
    const clave = url.includes('deudas/resumen') ? 'deudas'
      : url.includes('Dashboard/summary') ? 'dashboard'
      : url.includes('Inicio/resumen') ? 'resumen'
      : url.includes('pendientes-autorizacion') ? 'porAutorizar'
      : url.includes('Compras/resumen') ? 'compras'
      : url.includes('fechaDesde') ? 'hoy'
      : url.includes('tipoOperacion=1') ? 'presupuestos'
      : url.includes('tipoOperacion=2') ? 'pedidos'
      : 'otro'
    const valor = (r as Record<string, unknown>)[clave]
    if (valor instanceof Error) return Promise.reject(valor)
    if (valor !== undefined) return Promise.resolve(valor)
    return Promise.reject(clave === 'resumen' ? new ApiError(404, 'El recurso solicitado no existe.') : new Error(`sin respuesta: ${url}`))
  })
}

// Importes como los escribe formatImporte: sin centavos y con espacio duro tras el signo.
const ars = (cifra: string) => `$\u00A0${cifra}`
const usd = (cifra: string) => `USD\u00A0${cifra}`
const importe = (total: number, moneda = 'ARS') => ({ moneda, total })
const pendiente = (cantidad: number, ...importes: { moneda: string; total: number }[]) => ({ cantidad, importes })
/** InicioResumenDto de alguien con los dos módulos y CAP_AUTORIZAR_VENTA. */
const RESUMEN = {
  ventas: {
    presupuestosPendientes: pendiente(12, importe(1284300)),
    pedidosConfirmados: pendiente(5, importe(940120), importe(1200, 'USD')),
    porAutorizar: pendiente(1, importe(80000)),
  },
  compras: { notasPedido: pendiente(3, importe(358777)), porRecibir: pendiente(0) },
  autorizacionesPendientes: pendiente(2, importe(302750)),
}
const pedidosDelResumen = () => mockGet.mock.calls.filter(([u]) => String(u).includes('Inicio/resumen')).length

const pagina = (totalCount: number, items: unknown[] = [{ id: 'x' }]) => ({ items, totalCount, page: 1, pageSize: 1, totalPages: totalCount, hasNextPage: totalCount > 1 })

function conPermisos(...modulos: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'Parraquini', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) },
  } as never)
}

/** Inicio con el QueryClient de la app (sin reintentos, salvo que se pase otro). */
function pintar(qc: QueryClient = crearQueryClient({ retry: false })) {
  const r = render(
    <QueryClientProvider client={qc}>
      <InicioScreen />
    </QueryClientProvider>,
  )
  return { qc, desmontar: r.unmount }
}

/**
 * Una mutación real de la app, con el mismo QueryClient que Inicio. Se monta antes que Inicio:
 * `screen` apunta a lo último que se pintó. Si el servidor la rechaza, el rechazo se ignora acá.
 */
function mutacion(qc: QueryClient, usar: () => { mutateAsync: (v: never) => Promise<unknown> }, variables: unknown) {
  const { result } = renderHook(usar, {
    wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  return () => act(async () => { await result.current.mutateAsync(variables as never).catch(() => undefined) })
}

const flat = (el: { props: { style?: unknown } }): ViewStyle => StyleSheet.flatten(el.props.style as StyleProp<ViewStyle>) ?? {}

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
})

describe('Inicio: ola B (ventas del día y deuda vencida)', () => {
  it('ventas del día sale de /Dashboard/summary.salesToday y la deuda vencida de /deudas/resumen', async () => {
    conPermisos('MOD_VENTAS', 'MOD_PAGOS')
    servidor({ resumen: RESUMEN, hoy: pagina(3, []), dashboard: { salesToday: 1284500 }, deudas: { clientesConDeuda: 7, totalDeudaClientes: 100, totalDeudaVencidaClientes: 2500000, proveedoresConDeuda: 0, totalDeudaProveedores: 0 } })
    pintar()
    expect(await screen.findByLabelText(`Ventas del día: ${ars("1.284.500,00")}, 3 ventas`)).toBeTruthy()
    expect(await screen.findByLabelText(`Vencido (más de 30 días): ${ars('2.500.000,00')}`)).toBeTruthy()
  })

  it('si salesToday viene null (sin dato) muestra "—"', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []), dashboard: { salesToday: null } })
    pintar()
    expect(await screen.findByLabelText('Ventas del día: —')).toBeTruthy()
  })
})

describe('Inicio: me deben y debo salen de /deudas/resumen (MOD_PAGOS:Read)', () => {
  const DEUDAS = { clientesConDeuda: 7, totalDeudaClientes: 48920300, proveedoresConDeuda: 2, totalDeudaProveedores: 21150000 }

  it('con MOD_PAGOS:Read muestra lo que deben los clientes y lo que se debe a proveedores', async () => {
    conPermisos('MOD_VENTAS', 'MOD_PAGOS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []), deudas: DEUDAS })
    pintar()

    expect(await screen.findByLabelText(`Me deben los clientes: ${ars('48.920.300,00')}`)).toBeTruthy()
    expect(screen.getByLabelText(`Debo a proveedores: ${ars('21.150.000,00')}`)).toBeTruthy()
  })

  it('sin MOD_PAGOS:Read no pide el resumen y muestra "—"', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []), deudas: DEUDAS })
    pintar()

    expect(await screen.findByLabelText('Me deben los clientes: —')).toBeTruthy()
    expect(screen.getByLabelText('Debo a proveedores: —')).toBeTruthy()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('deudas/resumen'))).toBe(false)
  })

  it('si el resumen falla muestra "—", nunca 0', async () => {
    conPermisos('MOD_VENTAS', 'MOD_PAGOS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []), deudas: new Error('boom') })
    pintar()

    expect(await screen.findByLabelText('Me deben los clientes: —')).toBeTruthy()
  })
})

describe('Inicio: acción Buscar (bloque 12, R14)', () => {
  it('la barra ofrece Buscar, que abre la búsqueda', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()

    await userEvent.press(screen.getByRole('button', { name: 'Buscar' }))
    expect(mockPush).toHaveBeenCalledWith('/buscar')
  })
})

describe('Inicio: "Ver todo" de lo reciente', () => {
  it('quien entra a Ventas lo ve y abre la lista', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()

    await userEvent.press(await screen.findByRole('link', { name: 'Ver todo' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas')
  })

  it('el chofer lee ventas (el pedido de su parada) pero Ventas lo bloquea: no se le ofrece un enlace muerto', async () => {
    conPermisos('MOD_VIAJES', 'MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()

    expect(await screen.findByText('Reciente · Hoy')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ver todo' })).toBeNull()
  })
})

describe('Inicio: el cuadro "Rutas activas"', () => {
  it('con MOD_VIAJES abre la lista de hojas de ruta; sin MOD_VIAJES no es un botón', async () => {
    conPermisos('MOD_VENTAS', 'MOD_VIAJES')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: /^Rutas activas/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/logistica/hojas')
  })

  it('sin MOD_VIAJES el cuadro no es un botón', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()
    expect(await screen.findByLabelText(/^Rutas activas/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Rutas activas/ })).toBeNull()
  })
})

describe('Inicio: resumen en una llamada (GET /Inicio/resumen)', () => {
  it('"Por autorizar" y "Por recibir" salen una sola vez, en "Para resolver", y no hay tarjetas Ventas/Compras (lámina inicio-general)', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ resumen: { ...RESUMEN, compras: { ...RESUMEN.compras, porRecibir: pendiente(3) } }, hoy: pagina(0, []) })
    pintar()

    // Con la capacidad, "Por autorizar" es la bandeja de todos, no las propias.
    expect(await screen.findByLabelText('Para resolver, Por autorizar: 2')).toBeTruthy()
    expect(screen.getAllByLabelText(/Por autorizar/)).toHaveLength(1)
    expect(screen.getByLabelText('Para resolver, Por recibir: 3')).toBeTruthy()
    expect(screen.getAllByLabelText(/Por recibir/)).toHaveLength(1)
    expect(screen.queryByTestId('inicio-pendientes')).toBeNull()
    expect(screen.queryByLabelText('Ventas pendientes')).toBeNull()
    expect(screen.queryByLabelText('Compras pendientes')).toBeNull()
    // Todo sale de una sola llamada: ni listas para contar, ni la bandeja, ni el resumen de compras.
    expect(mockGet.mock.calls.map(([u]) => String(u)).filter((u) => !u.includes('fechaDesde') && !u.includes('Dashboard/summary'))).toEqual(['/api/v1/Inicio/resumen'])
  })

  it('una sección que el servidor manda en null no se muestra, aunque el teléfono crea tener el módulo', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ resumen: { ventas: null, compras: RESUMEN.compras, autorizacionesPendientes: null }, hoy: pagina(0, []) })
    pintar()

    expect(await screen.findByLabelText('Para resolver, Por recibir: 0')).toBeTruthy()
    expect(screen.queryByLabelText(/Por autorizar/)).toBeNull()
  })

  it('vendedor sin CAP_AUTORIZAR_VENTA: ve las suyas como "Esperando autorización" y la fila lleva a Ventas filtrada por ese estado', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: { ventas: RESUMEN.ventas, compras: null, autorizacionesPendientes: null }, hoy: pagina(0, []) })
    pintar()

    const fila = await screen.findByLabelText('Para resolver, Esperando autorización: 1')
    expect(screen.getAllByLabelText(/Esperando autorización/)).toHaveLength(1)
    expect(screen.queryByLabelText(/Por autorizar/)).toBeNull()
    expect(screen.queryByLabelText(/Por recibir/)).toBeNull()
    await userEvent.setup().press(fila)
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion')
  })

  it('usuario desactivado (403): muestra el motivo en lugar de los pendientes, sin reintentar ni caer a las llamadas viejas', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ resumen: new ApiError(403, 'El usuario está desactivado.'), hoy: pagina(0, []) })
    pintar(crearQueryClient()) // con los reintentos de la app: un 403 no cambia al reintentar

    expect(await screen.findByText(/El usuario está desactivado\./, {}, { timeout: 500 })).toBeTruthy()
    expect(pedidosDelResumen()).toBe(1)
    expect(screen.queryByLabelText(/Para resolver, /)).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => /tipoOperacion|Compras\/resumen|pendientes-autorizacion/.test(String(u)))).toBe(false)
  })

  it('si el resumen falla por otra cosa muestra el error con "Reintentar", no filas en "—"', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ resumen: new ApiError(500, 'Error interno del servidor. Intentá más tarde.'), hoy: pagina(0, []) })
    pintar()

    expect(await screen.findByText('No se pudieron cargar los pendientes', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.queryByLabelText(/Para resolver, /)).toBeNull()

    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    await userEvent.setup().press(screen.getByRole('button', { name: 'Reintentar pendientes' }))
    expect(await screen.findByLabelText('Para resolver, Por recibir: 0')).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar los pendientes')).toBeNull()
  })

  it('mientras llega el resumen no muestra números viejos de las llamadas de respaldo ni filas sin dato', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    mockGet.mockImplementation((url: string) =>
      url.includes('Inicio/resumen') ? new Promise(() => {}) : Promise.resolve(pagina(0, [])))
    const qc = crearQueryClient({ retry: false })
    // Lo que quedó en caché de cuando el servidor no tenía /Inicio/resumen.
    qc.setQueryData([...ventasKeys.all, 'pendientes-autorizacion'], [{ id: 'a' }])
    pintar(qc)

    await screen.findByText('Todavía no hay ventas hoy.')
    expect(screen.queryByLabelText(/Para resolver, /)).toBeNull()
  })
})

describe('Inicio: cualquier mutación vuelve a pedir el resumen', () => {
  const RECIBIR_5 = { ...RESUMEN, compras: { ...RESUMEN.compras, porRecibir: pendiente(5) } }
  const POR_AUTORIZAR_4 = { ...RESUMEN, autorizacionesPendientes: pendiente(4, importe(400000)) }
  const casos = [
    // Crear una compra solo invalida la lista de compras, no comprasKeys.all.
    ['crear una compra', useCreateCompra, { proveedorId: 'p1', depositoId: 'd1', detalles: [] }, RECIBIR_5, 'Para resolver, Por recibir: 5'],
    ['anular una venta', useAnularVenta, { id: 'v1', version: 1, motivoAnulacion: 'Error de carga' }, POR_AUTORIZAR_4, 'Para resolver, Por autorizar: 4'],
  ] as const

  it.each(casos)('%s con Inicio en pantalla', async (_, usar, variables, despues, fila) => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    const qc = crearQueryClient({ retry: false })
    const mutar = mutacion(qc, usar, variables)
    pintar(qc)
    await screen.findByLabelText('Para resolver, Por recibir: 0')

    servidor({ resumen: despues, hoy: pagina(0, []) })
    await mutar()
    expect(await screen.findByLabelText(fila)).toBeTruthy()
    expect(pedidosDelResumen()).toBe(2)
  })

  it('un 409 al autorizar (la venta cambió) también vuelve a pedir "Por autorizar"', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    const qc = crearQueryClient({ retry: false })
    const autorizar = mutacion(qc, useAutorizarVenta, { id: 'v1', version: 1 })
    pintar(qc)
    await screen.findByLabelText('Para resolver, Por autorizar: 2')

    servidor({ resumen: { ...RESUMEN, autorizacionesPendientes: pendiente(1, importe(150000)) }, hoy: pagina(0, []) })
    mockEscribir.mockRejectedValueOnce(new ApiError(409, 'La venta fue modificada por otro usuario.'))
    await autorizar()
    expect(await screen.findByLabelText('Para resolver, Por autorizar: 1')).toBeTruthy()
  })

  it.each(casos)('%s con Inicio fuera de pantalla: al volver lo pide de nuevo', async (_, usar, variables, despues, fila) => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    const qc = crearQueryClient({ retry: false })
    const mutar = mutacion(qc, usar, variables)
    const { desmontar } = pintar(qc)
    await screen.findByLabelText('Para resolver, Por recibir: 0')
    desmontar()

    servidor({ resumen: despues, hoy: pagina(0, []) })
    await mutar()
    pintar(qc)
    expect(await screen.findByLabelText(fila)).toBeTruthy()
    expect(pedidosDelResumen()).toBe(2)
  })
})

describe('Inicio: servidor sin /Inicio/resumen (404), las cuatro llamadas de antes', () => {
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

    expect(await screen.findByLabelText('Para resolver, Por autorizar: 2')).toBeTruthy()
    expect(await screen.findByLabelText('Para resolver, Por recibir: 2')).toBeTruthy()
    expect(screen.getAllByLabelText(/Por autorizar/)).toHaveLength(1)
    expect(screen.getAllByLabelText(/Por recibir/)).toHaveLength(1)
    // Primero se pidió el resumen; con el 404 vino lo de antes, sin importes.
    expect(screen.queryByText(/\$/)).toBeNull()
    const urls = mockGet.mock.calls.map(([u]) => u as string)
    expect(urls[0]).toBe('/api/v1/Inicio/resumen')
    // El 404 del servidor viejo es esperado: no se registra como error (no va a Sentry en cada montaje).
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Inicio/resumen', { estadosEsperados: [404] })
    // Los filtros que cuentan: Presupuesto+Pendiente y Pedido+Confirmada.
    expect(urls.some((u) => u.includes('tipoOperacion=1') && u.includes('estado=Pendiente'))).toBe(true)
    expect(urls.some((u) => u.includes('tipoOperacion=2') && u.includes('estado=Confirmada'))).toBe(true)
  })

  it('sin dato del servidor la fila no se muestra, nunca un 0', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ presupuestos: pagina(7), pedidos: pagina(1), hoy: pagina(0, []) }) // compras falla
    pintar()

    await screen.findByText('Todavía no hay ventas hoy.')
    expect(screen.queryByLabelText(/Por recibir/)).toBeNull()
    expect(screen.queryByTestId('para-resolver')).toBeNull()
  })

  it('"Por autorizar" no aparece ni se pide sin CAP_AUTORIZAR_VENTA', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), porAutorizar: [{ id: 'a' }], hoy: pagina(0, []) })
    pintar()

    await screen.findByText('Todavía no hay ventas hoy.')
    expect(screen.queryByLabelText(/Por autorizar/)).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('pendientes-autorizacion'))).toBe(false)
    // Sin MOD_COMPRAS tampoco hay "Por recibir".
    expect(screen.queryByLabelText(/Por recibir/)).toBeNull()
  })

  it('cada fila lleva a su lista ya filtrada por lo que cuenta', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'CAP_AUTORIZAR_VENTA')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), porAutorizar: [{ id: 'a' }], compras: { notasPedido: 1, confirmadas: 1 }, hoy: pagina(0, []) })
    pintar()
    const user = userEvent.setup()

    await user.press(await screen.findByLabelText('Para resolver, Por recibir: 1'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/compras?estado=Confirmado')
    // Con la capacidad, la fila es la bandeja: va a Autorizaciones.
    await user.press(await screen.findByLabelText('Para resolver, Por autorizar: 1'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/autorizaciones')
  })
})

describe('Inicio: Reciente · Hoy', () => {
  it('usa la dirección como título y el nombre en su propia línea', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(1, [VENTA_HOY]) })
    pintar()

    const tarjeta = await screen.findByLabelText(/^Pedido A00418 · Emanuel Parraquini/)
    expect(within(tarjeta).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(tarjeta).getByText('Carlos')).toBeTruthy()
    expect(within(tarjeta).queryByText(/Juan B\. Justo 6376.*Carlos/)).toBeNull()
  })

  it('si la consulta de hoy falla muestra un error con "Reintentar", no un día vacío', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN }) // hoy falla
    pintar()

    expect(await screen.findByText('No se pudieron cargar las ventas de hoy')).toBeTruthy()
    expect(screen.queryByText('Todavía no hay ventas hoy.')).toBeNull()

    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    const user = userEvent.setup()
    await user.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Todavía no hay ventas hoy.')).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar las ventas de hoy')).toBeNull()
  })

  it('un día vacío con éxito dice que no hay ventas', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()
    expect(await screen.findByText('Todavía no hay ventas hoy.')).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar las ventas de hoy')).toBeNull()
  })

  it('"hoy" es el día argentino aunque el teléfono esté en UTC (01:30Z = 10-10 en Argentina)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-11T01:30:00Z'), doNotFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] })
    try {
      conPermisos('MOD_VENTAS')
      servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
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
      servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
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
    servidor({ resumen: RESUMEN, hoy: pagina(1, [VENTA_HOY]) }) // 13:03Z
    pintar()
    const tarjeta = await screen.findByLabelText(/^Pedido A00418/)
    expect(within(tarjeta).getByText('10:03')).toBeTruthy()
  })
})

describe('Inicio: tablet', () => {
  it('con ancho ≥ 900 los pendientes siguen saliendo una sola vez, en "Para resolver"', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS')
    servidor({ presupuestos: pagina(1), pedidos: pagina(1), compras: { notasPedido: 1, confirmadas: 1 }, hoy: pagina(0, []) })
    mockAncho.mockReturnValue(900)
    pintar()
    await screen.findByLabelText('Para resolver, Por recibir: 1')

    expect(screen.queryByTestId('inicio-pendientes')).toBeNull()
    expect(screen.getAllByLabelText(/Por recibir/)).toHaveLength(1)
  })
})

describe('Inicio: encabezado y "Para resolver" (lámina inicio-general)', () => {
  const { useThemeStore, themeColors } = require('@/libs/theme')
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  it('el encabezado dice "Hola, <nombre>" con el día debajo, no "Inicio"', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    pintar()
    expect(await screen.findByText('Hola, Emanuel')).toBeTruthy()
    expect(screen.queryByText('Inicio')).toBeNull()
  })

  it('lista solo las filas que el usuario puede ver y que tienen dato, cada una con su destino', async () => {
    conPermisos('MOD_VENTAS', 'MOD_COMPRAS', 'MOD_STOCK', 'CAP_AUTORIZAR_VENTA')
    servidor({ resumen: { ...RESUMEN, compras: { ...RESUMEN.compras, porRecibir: pendiente(3) } }, hoy: pagina(0, []), dashboard: { salesToday: 1, lowStockAlerts: 18 } })
    pintar()
    const user = userEvent.setup()
    expect(await screen.findByText('Para resolver')).toBeTruthy()
    const lista = screen.getByTestId('para-resolver')
    expect(within(lista).getByLabelText('Para resolver, Por autorizar: 2')).toBeTruthy()
    expect(within(await within(lista).findByLabelText('Para resolver, Alertas de stock: 18')).getByText('18')).toBeTruthy()
    expect(within(lista).getByLabelText('Para resolver, Por recibir: 3')).toBeTruthy()
    await user.press(within(lista).getByLabelText('Para resolver, Alertas de stock: 18'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/inventario/stock')
    await user.press(within(lista).getByLabelText('Para resolver, Por autorizar: 2'))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/autorizaciones')
  })

  it('sin permiso de Stock o de Compras, o sin dato, la fila no aparece', async () => {
    conPermisos('MOD_VENTAS')
    servidor({ resumen: { ...RESUMEN, compras: null, autorizacionesPendientes: null }, hoy: pagina(0, []), dashboard: { salesToday: 1, lowStockAlerts: 18 } })
    pintar()
    await screen.findByText('Hola, Emanuel')
    expect(screen.queryByLabelText(/Para resolver, Alertas de stock/)).toBeNull()
    expect(screen.queryByLabelText(/Para resolver, Por recibir/)).toBeNull()
  })

  it('"Nueva venta" es el botón relleno de color de marca', async () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', roles: [], permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: true }] },
    } as never)
    servidor({ resumen: RESUMEN, hoy: pagina(0, []) })
    useThemeStore.setState({ mode: 'light' })
    pintar()
    const b = await screen.findByRole('button', { name: 'Nueva venta' })
    expect(flat(b).backgroundColor).toBe(themeColors.light.action)
  })
})
