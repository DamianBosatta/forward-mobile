import React from 'react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { cleanup, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { storage } from '@/core/utils/storage'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const ev = (o: Record<string, unknown>) => ({ origenId: 'o', origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, fecha: '2026-11-11', ...o })
const LUN_A_VIE = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: false, domingo: false }
let eventos: unknown[] = []
let dias: unknown = LUN_A_VIE
let feriados: unknown = [{ fecha: '2026-11-13', descripcion: 'Día de Ejemplo' }]

const urls = () => mockGet.mock.calls.map(([u]) => String(u))
const calendario = () => urls().filter((u) => u.startsWith('/api/v1/Calendario?'))
const permisos = (caps: string[]) =>
  useAuthStore.setState({ user: { id: 'u1', username: 'v', roles: ['Empleado'], permissions: caps.map((module) => ({ module, canRead: true })) } as never })
const pintar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CalendarioScreen /></QueryClientProvider>)
const vista = (nombre: string) => screen.getByRole('radio', { name: nombre })

describe.each(TEMAS)('Calendario como la web (%s)', (tema) => {
  beforeEach(() => {
    jest.clearAllMocks()
    conTema(tema)
    storage.clearAll()
    permisos([])
    // Miércoles 11 de noviembre de 2026, mediodía en Argentina.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-11T15:00:00Z'))
    eventos = []
    dias = LUN_A_VIE
    feriados = [{ fecha: '2026-11-13', descripcion: 'Día de Ejemplo' }]
    mockGet.mockImplementation((url: string) => Promise.resolve(
      url.includes('dias-entrega') ? dias : url.includes('feriados') ? feriados : eventos))
  })
  afterEach(() => jest.restoreAllMocks())

  it('abre en Semana con el período, "Hoy" y los siete días de lunes a domingo', async () => {
    pintar()
    expect(await screen.findByText('9 nov – 15 nov')).toBeTruthy()
    expect(vista('Semana').props.accessibilityState.checked).toBe(true)
    for (const v of ['Mes', 'Día', 'Agenda']) expect(vista(v).props.accessibilityState.checked).toBe(false)
    expect(screen.getByLabelText('Hoy')).toBeTruthy()
    expect(calendario()).toContain('/api/v1/Calendario?Desde=2026-11-09&Hasta=2026-11-15')
    expect(await screen.findByText('Lun 9')).toBeTruthy()
    for (const d of ['Lun 9', 'Mar 10', 'Mié 11', 'Jue 12', 'Vie 13', 'Sáb 14', 'Dom 15']) expect(screen.getByText(d)).toBeTruthy()
    expect(screen.getAllByText('Sin eventos')).toHaveLength(7)
    await userEvent.press(screen.getByLabelText('Siguiente'))
    expect(await screen.findByText('16 nov – 22 nov')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Hoy'))
    expect(await screen.findByText('9 nov – 15 nov')).toBeTruthy()
  })

  it('recuerda en el teléfono la vista elegida', async () => {
    const { unmount } = pintar()
    await screen.findByText('9 nov – 15 nov')
    await userEvent.press(vista('Mes'))
    expect(await screen.findByText('Noviembre de 2026')).toBeTruthy()
    unmount()
    pintar()
    expect(await screen.findByText('Noviembre de 2026')).toBeTruthy()
    expect(vista('Mes').props.accessibilityState.checked).toBe(true)
    expect(calendario()).toContain('/api/v1/Calendario?Desde=2026-10-26&Hasta=2026-12-06')
  })

  it('a quien no es de gestión le ofrece Servicios, Obligaciones y Eventos; apagar un chip saca ese tipo', async () => {
    eventos = [ev({ clave: 'a', titulo: 'Pagar la luz', tipo: 'ServicioRecurrente' }), ev({ clave: 'b', titulo: 'Llamar a un cliente' })]
    pintar()
    expect(await screen.findByText('Pagar la luz')).toBeTruthy()
    const tipos = within(screen.getByLabelText('Filtrar por tipo'))
    expect(tipos.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Servicios', 'Obligaciones', 'Eventos'])
    await userEvent.press(tipos.getByLabelText('Servicios'))
    expect(screen.queryByText('Pagar la luz')).toBeNull()
    expect(screen.getByText('Llamar a un cliente')).toBeTruthy()
  })

  it('con CAP_VER_TESORERIA ofrece los seis tipos de la web, en su orden', async () => {
    permisos(['CAP_VER_TESORERIA'])
    pintar()
    await screen.findByText('9 nov – 15 nov')
    expect(within(screen.getByLabelText('Filtrar por tipo')).getAllByRole('button').map((b) => b.props.accessibilityLabel))
      .toEqual(['Cheques recibidos', 'Cheques emitidos', 'Compras', 'Servicios', 'Obligaciones', 'Eventos'])
  })

  it('muestra la leyenda de estados como la web', async () => {
    pintar()
    await screen.findByText('9 nov – 15 nov')
    const leyenda = within(screen.getByLabelText('Leyenda de estados'))
    for (const e of ['Pendiente', 'Vencido', 'Pagado', 'Omitido']) expect(leyenda.getByText(e)).toBeTruthy()
  })

  it('marca el feriado con su nombre y los días sin entregas', async () => {
    pintar()
    expect(await screen.findByText('Feriado: Día de Ejemplo')).toBeTruthy()
    expect(within(screen.getByTestId('dia-2026-11-13')).getByText('Feriado: Día de Ejemplo')).toBeTruthy()
    expect(within(screen.getByTestId('dia-2026-11-14')).getByText('Sin entregas')).toBeTruthy()
    expect(within(screen.getByTestId('dia-2026-11-15')).getByText('Sin entregas')).toBeTruthy()
    expect(within(screen.getByTestId('dia-2026-11-12')).queryByText('Sin entregas')).toBeNull()
    expect(screen.getAllByText('Sin entregas')).toHaveLength(2)
  })

  it('sin la configuración de entregas no marca ningún día', async () => {
    dias = undefined
    mockGet.mockImplementation((url: string) => url.includes('dias-entrega') ? Promise.reject(new Error('x')) : Promise.resolve(url.includes('feriados') ? feriados : eventos))
    pintar()
    await screen.findByText('9 nov – 15 nov')
    expect(screen.queryByText('Sin entregas')).toBeNull()
    expect(screen.queryByText('Feriado: Día de Ejemplo')).toBeNull()
  })

  it('la tarjeta dice hora y tipo, título, "Para …", importe, depósito y el estado', async () => {
    eventos = [ev({
      clave: 't', titulo: 'Cobrar: Av. Ejemplo 1234', hora: '15:00:00', monto: 120000, tipoTarea: 'CobroPendiente', estadoTarea: 'EnCurso',
      asignados: [{ id: 'u', nombre: 'Vendedor Ejemplo' }], depositoId: 'd1', depositoNombre: 'Depósito Central',
    })]
    pintar()
    const tarjeta = within(await screen.findByLabelText('Cobrar: Av. Ejemplo 1234, En curso'))
    expect(tarjeta.getByText('15:00 · Cobro pendiente')).toBeTruthy()
    expect(tarjeta.getByText('Para Vendedor Ejemplo')).toBeTruthy()
    expect(tarjeta.getByText('$ 120.000,00')).toBeTruthy()
    expect(tarjeta.getByText('Depósito Central')).toBeTruthy()
    expect(tarjeta.getByText('En curso')).toBeTruthy()
  })

  it('la tarea muestra su propio estado; vencida y abierta dice "Vencido"; un evento cancelado, "Omitido"', async () => {
    eventos = [
      ev({ clave: '1', titulo: 'Tarea hecha', estado: 'Pagado', tipoTarea: 'General', estadoTarea: 'Hecha' }),
      ev({ clave: '2', titulo: 'Tarea pendiente', tipoTarea: 'General', estadoTarea: 'Pendiente' }),
      ev({ clave: '3', titulo: 'Tarea vencida', estado: 'Vencido', tipoTarea: 'EntregaPendiente', estadoTarea: 'EnCurso' }),
      ev({ clave: '4', titulo: 'Tarea cancelada', estado: 'Vencido', tipoTarea: 'General', estadoTarea: 'Cancelada' }),
      ev({ clave: '5', titulo: 'Pagar internet', tipo: 'ServicioRecurrente', estado: 'Cancelado' }),
      ev({ clave: '6', titulo: 'Rendir la caja', estado: 'Pagado' }),
    ]
    pintar()
    expect(await screen.findByLabelText('Tarea hecha, Hecha')).toBeTruthy()
    expect(screen.getByLabelText('Tarea pendiente, Pendiente')).toBeTruthy()
    expect(screen.getByLabelText('Tarea vencida, Vencido')).toBeTruthy()
    expect(screen.getByLabelText('Tarea cancelada, Cancelada')).toBeTruthy()
    expect(screen.getByLabelText('Pagar internet, Omitido')).toBeTruthy()
    expect(screen.getByLabelText('Rendir la caja, Pagado')).toBeTruthy()
  })

  it('Mes: hasta 3 marcas por día y "+N más"; tocar un día abre su semana', async () => {
    eventos = ['a', 'b', 'c', 'd', 'e'].map((k) => ev({ clave: k, titulo: `Evento ${k}`, fecha: '2026-11-20' }))
      .concat([ev({ clave: 'x', titulo: 'Solo', fecha: '2026-11-11' })])
    pintar()
    await screen.findByText('9 nov – 15 nov')
    await userEvent.press(vista('Mes'))
    const dia20 = within(await screen.findByTestId('celda-2026-11-20'))
    expect(dia20.getAllByTestId('marca')).toHaveLength(3)
    expect(dia20.getByText('+2 más')).toBeTruthy()
    expect(within(screen.getByTestId('celda-2026-11-11')).getAllByTestId('marca')).toHaveLength(1)
    expect(within(screen.getByTestId('celda-2026-11-11')).queryByText(/más/)).toBeNull()
    expect(within(screen.getByTestId('celda-2026-11-13')).getByText('Feriado')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Ver la semana del viernes, 20 de noviembre, 5 eventos'))
    expect(await screen.findByText('16 nov – 22 nov')).toBeTruthy()
    expect(vista('Semana').props.accessibilityState.checked).toBe(true)
    expect(screen.getByText('Evento e')).toBeTruthy()
  })

  it('Día: un solo día; las flechas pasan de a un día', async () => {
    eventos = [ev({ clave: 'a', titulo: 'Pagar la luz', tipo: 'ServicioRecurrente', hora: '09:30', monto: 48300 })]
    pintar()
    await screen.findByText('9 nov – 15 nov')
    await userEvent.press(vista('Día'))
    expect((await screen.findAllByText('Miércoles, 11 de noviembre')).length).toBeGreaterThan(0)
    expect(calendario()).toContain('/api/v1/Calendario?Desde=2026-11-11&Hasta=2026-11-11')
    const fila = within(screen.getByLabelText('Pagar la luz, Pendiente'))
    expect(fila.getByText('09:30')).toBeTruthy()
    expect(fila.getByText('Servicio')).toBeTruthy()
    expect(fila.getByText('Empresa')).toBeTruthy()
    expect(fila.getByText('$ 48.300,00')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Siguiente'))
    expect(await screen.findByText('Jueves, 12 de noviembre')).toBeTruthy()
  })

  it('Agenda: 30 días desde el elegido, solo los días con eventos', async () => {
    eventos = [
      ev({ clave: 'a', titulo: 'Pagar la luz', fecha: '2026-11-11' }),
      ev({ clave: 'b', titulo: 'VTV de la camioneta', fecha: '2026-11-12', estado: 'Vencido' }),
      ev({ clave: 'c', titulo: 'Entrega', fecha: '2026-11-18' }),
    ]
    pintar()
    await screen.findByText('9 nov – 15 nov')
    await userEvent.press(vista('Agenda'))
    expect(await screen.findByText('Desde miércoles, 11 de noviembre')).toBeTruthy()
    expect(calendario()).toContain('/api/v1/Calendario?Desde=2026-11-11&Hasta=2026-12-10')
    expect(screen.getByText('Jueves, 12 de noviembre')).toBeTruthy()
    expect(screen.getByText('Miércoles, 18 de noviembre')).toBeTruthy()
    expect(screen.queryByText('Viernes, 13 de noviembre')).toBeNull()
    expect(screen.getByText(' (hoy)')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Siguiente'))
    expect(await screen.findByText('Desde viernes, 11 de diciembre')).toBeTruthy()
  })

  it('Agenda sin eventos con los filtros lo dice', async () => {
    eventos = [ev({ clave: 'a', titulo: 'Pagar la luz', tipo: 'ServicioRecurrente' })]
    pintar()
    await screen.findByText('Pagar la luz')
    await userEvent.press(vista('Agenda'))
    await userEvent.press(within(screen.getByLabelText('Filtrar por tipo')).getByLabelText('Servicios'))
    expect(await screen.findByText('No hay eventos con estos filtros.')).toBeTruthy()
  })

  it('sin CAP_VER_TODOS_LOS_DEPOSITOS no hay selector de depósito', async () => {
    eventos = [ev({ clave: 'a', titulo: 'Entrega norte', depositoId: 'n', depositoNombre: 'Depósito Norte' })]
    pintar()
    await screen.findByText('Entrega norte')
    expect(screen.queryByLabelText('Todos los depósitos')).toBeNull()
  })

  it('con CAP_VER_TODOS_LOS_DEPOSITOS elige un depósito o "Empresa"', async () => {
    permisos(['CAP_VER_TODOS_LOS_DEPOSITOS'])
    eventos = [
      ev({ clave: 'a', titulo: 'Entrega norte', depositoId: 'n', depositoNombre: 'Depósito Norte' }),
      ev({ clave: 'b', titulo: 'Entrega central', depositoId: 'c', depositoNombre: 'Depósito Central' }),
      ev({ clave: 'e', titulo: 'Pagar la luz' }),
    ]
    pintar()
    await screen.findByText('Entrega norte')
    const selector = within(screen.getByLabelText('Depósito'))
    expect(selector.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Todos los depósitos', 'Depósito Central', 'Depósito Norte', 'Empresa'])
    await userEvent.press(selector.getByLabelText('Depósito Norte'))
    expect(screen.getByText('Entrega norte')).toBeTruthy()
    expect(screen.queryByText('Entrega central')).toBeNull()
    expect(screen.queryByText('Pagar la luz')).toBeNull()
    await userEvent.press(selector.getByLabelText('Empresa'))
    expect(screen.getByText('Pagar la luz')).toBeTruthy()
    expect(screen.queryByText('Entrega norte')).toBeNull()
  })

  it('con error dice que no se pudo cargar y ofrece reintentar', async () => {
    mockGet.mockImplementation((url: string) => url.startsWith('/api/v1/Calendario?') ? Promise.reject(new Error('500')) : Promise.resolve([]))
    pintar()
    expect(await screen.findByText('No se pudo cargar el calendario.')).toBeTruthy()
    expect(screen.getByLabelText('Reintentar')).toBeTruthy()
  })

  const llamadasAlCalendario = () => urls().filter((u) => u.startsWith('/api/v1/Calendario?')).length

  it('mientras carga muestra los esqueletos', async () => {
    mockGet.mockImplementation((url: string) => url.startsWith('/api/v1/Calendario?') ? new Promise(() => {}) : Promise.resolve([]))
    pintar()
    expect(await screen.findByLabelText('Cargando')).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila').length).toBeGreaterThan(0)
  })

  it('Agenda vacía usa el estado de pantalla con su texto', async () => {
    eventos = []
    pintar()
    await userEvent.press(vista('Agenda'))
    expect(await screen.findByRole('header', { name: 'No hay eventos con estos filtros.' })).toBeTruthy()
  })

  it('Reintentar del error vuelve a pedir el calendario', async () => {
    mockGet.mockImplementation((url: string) => url.startsWith('/api/v1/Calendario?') ? Promise.reject(new Error('500')) : Promise.resolve([]))
    pintar()
    await screen.findByText('No se pudo cargar el calendario.')
    const antes = llamadasAlCalendario()
    await userEvent.press(screen.getByLabelText('Reintentar'))
    await waitFor(() => expect(llamadasAlCalendario()).toBeGreaterThan(antes))
  })

  it('sin red la consulta queda en pausa (sin error): sin nada guardado muestra sin conexión, no el vacío', async () => {
    onlineManager.setOnline(false)
    try {
      pintar()
      expect(await screen.findByRole('header', { name: 'No pudimos cargar el calendario' })).toBeTruthy()
      expect(screen.getByLabelText('Reintentar')).toBeTruthy()
      expect(llamadasAlCalendario()).toBe(0)
    } finally {
      cleanup()
      onlineManager.setOnline(true)
    }
  })

  it('sin red y sin nada guardado muestra la pantalla de sin conexión; Reintentar vuelve a pedir', async () => {
    mockGet.mockImplementation((url: string) => url.startsWith('/api/v1/Calendario?') ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve([]))
    pintar()
    expect(await screen.findByRole('header', { name: 'No pudimos cargar el calendario' })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()
    const antes = llamadasAlCalendario()
    await userEvent.press(screen.getByLabelText('Reintentar'))
    await waitFor(() => expect(llamadasAlCalendario()).toBeGreaterThan(antes))
  })
})
