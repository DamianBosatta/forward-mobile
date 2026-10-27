import React from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { themeColors } from '@/libs/theme'
import { conTema, estilo } from '@/core/ui/fw/__testing__/tema'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))

const parada = (o: { id: string } & Record<string, unknown>) => ({
  ventaId: 'v', telefono: '11 4567-8900', cantidadBultos: 2, latitud: 0, longitud: 0, estado: 1, ...o,
})

const HOJA = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z',
  detalles: [
    parada({ id: 'p6', orden: 6, direccion: 'Luis Balcarce 312', clienteNombre: 'Almacén Luis', montoTotal: 1000 }),
    parada({ id: 'p4', orden: 4, direccion: 'Juan B. Justo 6376', clienteNombre: 'Carlos', montoTotal: 214560, cantidadBultos: 3 }),
    parada({ id: 'p2', orden: 2, direccion: 'Tarantino 1898', clienteNombre: 'Autoservicio Abel', montoTotal: 50, estado: 2 }),
    parada({ id: 'p5', orden: 5, direccion: 'Av. del Valle 89', clienteNombre: 'Chela', montoTotal: 59566.01 }),
  ],
}

let hojaServidor: unknown = HOJA
let listaServidor: (url: string) => unknown = () => [{ id: 'h1' }]

/** La entrega va en pasos (bloque 12, T12c): sin devolución y sin cobro, hasta el resumen donde está "Confirmar entrega". */
async function alResumen() {
  await userEvent.press(screen.getByLabelText('No, recibió todo'))
  await userEvent.press(screen.getByLabelText('Continuar'))
  await userEvent.press(screen.getByLabelText('Continuar'))
}

function pintar(hoja: unknown = HOJA, choferId = 'u1', permissions: unknown[] = [{ module: 'MOD_VIAJES', canRead: true }]) {
  hojaServidor = hoja
  useAuthStore.setState({
    user: { id: choferId, username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions },
  } as never)
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/hojas-ruta/h1') ? Promise.resolve(hojaServidor)
      : url.includes('hojas-ruta?') ? Promise.resolve(listaServidor(url))
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  useLogisticaStore.setState({ activeTrip: null })
  listaServidor = () => [{ id: 'h1' }]
  conTema('light')
})

describe('Consola del chofer: hoja de ruta', () => {
  it('la próxima parada es la pendiente de menor orden, con la dirección como título y el nombre aparte', async () => {
    pintar()
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(within(proxima).getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(within(proxima).getByText('Carlos')).toBeTruthy()
    expect(within(proxima).getByText('Parada 2 · 3 bultos')).toBeTruthy()
    // El importe es el total que manda el servidor, sin inventar el tipo de cobro.
    expect(within(proxima).getByText('$ 214.560,00')).toBeTruthy()
    expect(screen.getByText('1 de 4 entregas')).toBeTruthy()
    expect(screen.getByLabelText('Parada 3: Av. del Valle 89')).toBeTruthy()
    expect(screen.getByLabelText('Parada 4: Luis Balcarce 312')).toBeTruthy()
    expect(within(screen.getByLabelText('Parada 1: Tarantino 1898')).getByLabelText('Estado: Entregado')).toBeTruthy()
  })

  it('Cómo llegar abre el mapa con la dirección y Llamar marca el teléfono', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    pintar()
    await userEvent.press(await screen.findByLabelText('Cómo llegar'))
    const mapa = String(abrir.mock.calls[0][0])
    expect(mapa).toContain(encodeURIComponent('Juan B. Justo 6376'))
    expect(mapa).toMatch(Platform.OS === 'ios' ? /^maps:/ : /google\.com\/maps\/dir/)
    await userEvent.press(screen.getByLabelText('Llamar'))
    expect(abrir).toHaveBeenLastCalledWith('tel:1145678900')
  })

  it('entregado: no confirma sin quién recibió y manda la entrega por la operación única (entregar)', async () => {
    // El servidor, después del reporte, devuelve la parada entregada.
    mockPost.mockImplementation(async () => {
      hojaServidor = { ...HOJA, detalles: HOJA.detalles.map((d) => (d.id === 'p4' ? { ...d, estado: 2 } : d)) }
      return true
    })
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    // Pasos de la entrega (T12c): sin quién recibió no se sigue; recién el último paso confirma.
    expect(screen.getByLabelText('Continuar').props.accessibilityState.disabled).toBe(true)
    await userEvent.press(screen.getByLabelText('No, recibió todo'))
    expect(screen.getByLabelText('Continuar').props.accessibilityState.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Carlos')
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/paradas/p4/entregar', {
      claveIdempotencia: expect.any(String), nombreReceptor: 'Carlos',
    })
    expect(await screen.findByText('2 de 4 entregas')).toBeTruthy()
    expect(screen.queryByLabelText('Confirmar entrega')).toBeNull()
  })

  it('no se pudo entregar: pide el motivo y lo manda como motivoRechazo', async () => {
    mockPost.mockResolvedValue(true)
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    await userEvent.press(screen.getByLabelText('No se pudo entregar'))
    expect(screen.getByLabelText('Confirmar: no se entregó').props.accessibilityState.disabled).toBe(true)
    await userEvent.press(screen.getByLabelText('Dirección incorrecta'))
    await userEvent.press(screen.getByLabelText('Confirmar: no se entregó'))
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('reportar-parada'), expect.objectContaining({
      paradaId: 'p4', entregado: false, motivoRechazo: 'Dirección incorrecta',
    }))
  })

  it('si el servidor rechaza, el motivo queda a la vista y el reporte sigue abierto', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('La venta ya no está en ruta.'), { errors: [] }))
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Carlos')
    await alResumen()
    await userEvent.press(screen.getByLabelText('Confirmar entrega'))
    expect(await screen.findByText('La venta ya no está en ruta.')).toBeTruthy()
    expect(screen.getByLabelText('Confirmar entrega')).toBeTruthy()
    expect(screen.getByText('1 de 4 entregas')).toBeTruthy()
  })

  it('antes de iniciar no se reporta; la hoja de otro chofer es solo lectura', async () => {
    pintar({ ...HOJA, estado: 1 })
    expect(await screen.findByLabelText('Iniciar recorrido')).toBeTruthy()
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
    screen.unmount()
    useLogisticaStore.setState({ activeTrip: null })
    pintar(HOJA, 'otro')
    expect(await screen.findByText(/es de otro chofer/)).toBeTruthy()
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
  })

  it('si la oficina cancela la hoja que el chofer tenía abierta, lo dice y no ofrece reportar ni iniciar', async () => {
    // El chofer la tenía guardada sin salir; desde #860 la oficina puede cancelarla mientras está Programada.
    useLogisticaStore.setState({ activeTrip: { ...HOJA, estado: 1 } as never })
    pintar({ ...HOJA, estado: 4 })
    expect(await screen.findByText(/cancelada/i)).toBeTruthy()
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
    expect(screen.queryByLabelText('Iniciar recorrido')).toBeNull()
    // No queda trabado en una hoja muerta.
    expect(screen.getByLabelText('Cambiar de ruta')).toBeTruthy()
  })

  it('Cambiar de ruta en una hoja cancelada no vuelve a elegirla sola con la lista vieja', async () => {
    // La lista de hoy la trajo Programada; después la oficina la canceló.
    listaServidor = () => [{ id: 'h1', estado: 1 }]
    pintar({ ...HOJA, estado: 4 })
    await screen.findByText('Hoja cancelada.')
    listaServidor = () => [{ id: 'h1', estado: 4 }]
    await userEvent.press(screen.getByLabelText('Cambiar de ruta'))
    expect(await screen.findByText('No tenés una hoja de ruta para hoy ni en curso.')).toBeTruthy()
    expect(screen.queryByText('Hoja cancelada.')).toBeNull()
  })

  it('si iniciar choca con una hoja que la oficina canceló, la hoja se vuelve a pedir y se ve cancelada', async () => {
    mockPost.mockImplementation(async () => {
      hojaServidor = { ...HOJA, estado: 4 }
      throw new Error('La hoja de ruta no está programada.')
    })
    pintar({ ...HOJA, estado: 1 })
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(await screen.findByText('Hoja cancelada.')).toBeTruthy()
    expect(screen.queryByLabelText('Iniciar recorrido')).toBeNull()
    expect(screen.getByText('La hoja de ruta no está programada.')).toBeTruthy()
  })

  it('con historial de rutas viejas y una para hoy, abre la de hoy sin pasar por el selector', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z')) // viernes 9 en Argentina
    // El servidor filtra por día: con fecha devuelve solo ese día; sin fecha, todo el historial.
    const historial = [
      { id: 'viejo', estado: 3, fechaSalida: '2026-10-01T11:00:00Z' },
      { id: 'h1', estado: 2, fechaSalida: '2026-10-09T11:00:00Z' },
      { id: 'cancelada', estado: 4, fechaSalida: '2026-10-09T12:00:00Z' },
    ]
    listaServidor = (url) => (
      url.includes('fecha=2026-10-09') ? historial.filter((r) => r.fechaSalida.startsWith('2026-10-09'))
        : url.includes('estado=2') ? historial.filter((r) => r.estado === 2)
        : historial
    )
    pintar()
    expect(await screen.findByLabelText('Próxima parada')).toBeTruthy()
    expect(screen.queryByText('Elegí la hoja de ruta')).toBeNull()
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Logistica/hojas-ruta?choferId=u1&fecha=2026-10-09')
  })

  it('sin ruta para hoy muestra el estado vacío y no una ruta vieja', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
    listaServidor = (url) => (url.includes('fecha=') || url.includes('estado=2') ? [] : [{ id: 'h1', estado: 3, fechaSalida: '2026-10-01T11:00:00Z' }])
    pintar()
    expect(await screen.findByText('No tenés una hoja de ruta para hoy ni en curso.')).toBeTruthy()
    expect(screen.queryByLabelText('Próxima parada')).toBeNull()
  })

  it('sin ruta hoy pero con una en curso de ayer, abre la de ayer', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
    listaServidor = (url) => (url.includes('fecha=') ? [] : url.includes('estado=2') ? [{ id: 'h1', estado: 2, fechaSalida: '2026-10-08T11:00:00Z' }] : [])
    pintar()
    expect(await screen.findByLabelText('Próxima parada')).toBeTruthy()
    expect(screen.queryByText(/No tenés una hoja de ruta/)).toBeNull()
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Logistica/hojas-ruta?choferId=u1&estado=2')
  })

  it('con una ruta de hoy sin iniciar y una en curso de ayer, abre primero la en curso', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
    listaServidor = (url) => (
      url.includes('fecha=') ? [{ id: 'hoy', estado: 1, fechaSalida: '2026-10-09T11:00:00Z' }]
        : url.includes('estado=2') ? [{ id: 'h1', estado: 2, fechaSalida: '2026-10-08T11:00:00Z' }]
        : []
    )
    pintar()
    expect(await screen.findByLabelText('Próxima parada')).toBeTruthy()
    expect(screen.queryByText('Elegí la hoja de ruta')).toBeNull()
  })

  it('con dos rutas en curso pendientes, el selector muestra ambas sin repetir', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
    const a = { id: 'aaaaaaaa-1', estado: 2, fechaSalida: '2026-10-09T11:00:00Z', cantidadParadas: 3 }
    const b = { id: 'bbbbbbbb-2', estado: 2, fechaSalida: '2026-10-08T11:00:00Z', cantidadParadas: 2 }
    listaServidor = (url) => (url.includes('fecha=') ? [a] : url.includes('estado=2') ? [a, b] : [])
    pintar()
    expect(await screen.findByText('Elegí la hoja de ruta')).toBeTruthy()
    expect(screen.getAllByText('Viaje #AAAAAAAA')).toHaveLength(1)
    expect(screen.getAllByText('Viaje #BBBBBBBB')).toHaveLength(1)
  })

  it('sin permiso de viajes muestra la pantalla de permiso y no consulta al servidor', async () => {
    pintar(HOJA, 'u1', [])
    expect(await screen.findByText('No tenés acceso a esta sección')).toBeTruthy()
    expect(screen.queryByLabelText('Cargando la hoja de ruta')).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('un doble toque rápido en confirmar manda un solo reporte', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    pintar()
    await userEvent.press(await screen.findByLabelText('Reportar entrega'))
    await userEvent.type(screen.getByLabelText('Quién recibió'), 'Carlos')
    await alResumen()
    const confirmar = screen.getByLabelText('Confirmar entrega')
    act(() => {
      fireEvent.press(confirmar)
      fireEvent.press(confirmar)
    })
    await act(async () => {})
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('en oscuro la tarjeta de la próxima parada usa la marca del tema oscuro', async () => {
    conTema('dark')
    pintar()
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(estilo(proxima).borderColor).toBe(themeColors.dark.brand)
    expect(estilo(proxima).backgroundColor).toBe(themeColors.dark.surface)
  })

  it('si la app vuelve del segundo plano pasada la medianoche, pide las rutas del día nuevo', async () => {
    const dia1 = Date.parse('2026-10-10T01:30:00Z') // viernes 9 en Argentina
    jest.spyOn(Date, 'now').mockReturnValue(dia1)
    let alCambiar: ((e: string) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
      alCambiar = cb
      return { remove: jest.fn() }
    }) as never)
    // Dos rutas: queda el selector y la consulta por día sigue activa.
    listaServidor = () => [{ id: 'aaaaaaaa-1', estado: 1, fechaSalida: '2026-10-09T11:00:00Z' }, { id: 'bbbbbbbb-2', estado: 1, fechaSalida: '2026-10-09T12:00:00Z' }]
    pintar()
    expect(await screen.findByText('Elegí la hoja de ruta')).toBeTruthy()
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T13:00:00Z')) // sábado 10
    act(() => { alCambiar?.('active') })
    await waitFor(() =>
      expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Logistica/hojas-ruta?choferId=u1&fecha=2026-10-10'),
    )
  })

  it('una hoja Documentada (5) deja iniciar el recorrido y manda el mismo POST que una Programada', async () => {
    mockPost.mockImplementation(async () => {
      hojaServidor = { ...HOJA, estado: 2 }
      return true
    })
    pintar({ ...HOJA, estado: 5 })
    expect(screen.queryByLabelText('Reportar entrega')).toBeNull()
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/iniciar', undefined)
  })

  it('si el servidor bloquea la salida de una Documentada, se ve su mensaje y la hoja sigue sin salir', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('Falta la documentación de 2 paradas.'), { errors: [] }))
    pintar({ ...HOJA, estado: 5 })
    await userEvent.press(await screen.findByLabelText('Iniciar recorrido'))
    expect(await screen.findByText('Falta la documentación de 2 paradas.')).toBeTruthy()
    expect(screen.getByLabelText('Iniciar recorrido')).toBeTruthy()
  })
})

describe('Consola del chofer: qué cobrar (fila 70)', () => {
  const conCobro = {
    ...HOJA,
    totalMontoCobrar: 130000,
    detalles: [
      parada({ id: 'p4', orden: 4, direccion: 'Juan B. Justo 6376', clienteNombre: 'Carlos', montoTotal: 214560, cantidadBultos: 3, tipoCobro: 'Contado', montoCobrar: 100000, numeroNotaEntrega: 16918 }),
      parada({ id: 'p5', orden: 5, direccion: 'Av. del Valle 89', clienteNombre: 'Chela', montoTotal: 59566.01, tipoCobro: 'Saldo', montoCobrar: 30000, numeroNotaEntrega: 16916 }),
      parada({ id: 'p6', orden: 6, direccion: 'Luis Balcarce 312', clienteNombre: 'Almacén Luis', montoTotal: 1000, tipoCobro: 'Pagado', montoCobrar: 0, numeroNotaEntrega: 16915 }),
      parada({ id: 'p7', orden: 7, direccion: 'Tarantino 1898', clienteNombre: 'Abel', montoTotal: 5000, tipoCobro: 'CuentaCorriente', montoCobrar: 5000, numeroNotaEntrega: 16914 }),
    ],
  }

  it('muestra el chip, "A cobrar" con el monto del servidor y "A cobrar hoy" arriba', async () => {
    pintar(conCobro)
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(within(proxima).getByLabelText('Estado: Cobrar contado')).toBeTruthy()
    expect(within(proxima).getByText('A cobrar')).toBeTruthy()
    // El monto a cobrar (100.000), no el total del pedido (214.560): el teléfono no calcula nada.
    expect(within(proxima).getByText('$ 100.000,00')).toBeTruthy()
    expect(within(proxima).queryByText('Total del pedido')).toBeNull()
    expect(within(proxima).getByText('Parada 1 · NTE16918 · 3 bultos')).toBeTruthy()
    expect(screen.getByText('$ 130.000,00')).toBeTruthy()
    expect(screen.getByText(/A cobrar hoy/)).toBeTruthy()
  })

  it('en la lista: saldo con su monto, pagado y cuenta corriente sin importe a cobrar', async () => {
    pintar(conCobro)
    await screen.findByLabelText('Próxima parada')
    const saldo = screen.getByLabelText('Parada 2: Av. del Valle 89')
    expect(within(saldo).getByLabelText('Estado: Cobrar saldo')).toBeTruthy()
    expect(within(saldo).getByText('$ 30.000,00')).toBeTruthy()
    const pagado = screen.getByLabelText('Parada 3: Luis Balcarce 312')
    expect(within(pagado).getByLabelText('Estado: Pagado')).toBeTruthy()
    expect(within(pagado).getByText('NTE16915 · nada que cobrar')).toBeTruthy()
    const cc = screen.getByLabelText('Parada 4: Tarantino 1898')
    expect(within(cc).getByLabelText('Estado: Cuenta corriente')).toBeTruthy()
    expect(within(cc).getByText('NTE16914 · no se cobra')).toBeTruthy()
    expect(within(cc).queryByText('$ 5.000,00')).toBeNull()
  })

  it('las paradas hechas vuelven a mostrar el total del pedido, no el monto a cobrar', async () => {
    pintar({
      ...conCobro,
      detalles: [
        parada({ id: 'p1', orden: 1, direccion: 'Hecha 1', clienteNombre: 'H', montoTotal: 9000, estado: 2, tipoCobro: 'Contado', montoCobrar: 4000 }),
        ...conCobro.detalles,
      ],
    })
    const hecha = await screen.findByLabelText('Parada 1: Hecha 1')
    expect(within(hecha).getByText('$ 9.000,00')).toBeTruthy()
    expect(within(hecha).queryByText('$ 4.000,00')).toBeNull()
    expect(within(hecha).queryByLabelText('Estado: Cobrar contado')).toBeNull()
  })

  it('con un servidor anterior (sin los campos) se ve como hoy: total del pedido, sin chip ni total', async () => {
    pintar()
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(within(proxima).getByText('Total del pedido')).toBeTruthy()
    expect(within(proxima).getByText('$ 214.560,00')).toBeTruthy()
    expect(within(proxima).queryByText('A cobrar')).toBeNull()
    expect(screen.queryByText(/Cobrar |Pagado|Cuenta corriente/)).toBeNull()
    expect(screen.queryByText(/A cobrar hoy/)).toBeNull()
  })

  it('con campos en null se ve como hoy', async () => {
    pintar({ ...HOJA, totalMontoCobrar: null, detalles: HOJA.detalles.map((d) => ({ ...d, tipoCobro: null, montoCobrar: null, numeroNotaEntrega: null })) })
    const proxima = await screen.findByLabelText('Próxima parada')
    expect(within(proxima).getByText('Total del pedido')).toBeTruthy()
    expect(screen.queryByText(/A cobrar hoy/)).toBeNull()
  })
})
