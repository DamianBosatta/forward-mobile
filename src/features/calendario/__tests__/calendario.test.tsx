import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent, within } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'
import { semanaDe, tituloSemana } from '../semana'
import type { Precarga } from '../NuevoEventoSheet'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }),
}))
let mockAlEnfocar: (() => void) | undefined
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    mockAlEnfocar = cb
    require('react').useEffect(cb, [])
  },
}))

const evento = (o: Record<string, unknown>) => ({
  origenId: 'o', origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, ...o,
})
const EVENTOS = [
  evento({ clave: 'a', fecha: '2026-10-09', titulo: 'Rendir la caja de la semana' }),
  evento({ clave: 'b', fecha: '2026-10-09', titulo: 'Cheque de Distribuidora Del Sur', tipo: 'ChequeRecibido', estado: 'Vencido', monto: 59566.01 }),
  evento({ clave: 'c', fecha: '2026-10-05', titulo: 'Llamar a Sofía', estado: 'Pagado' }),
]

function pintar(precarga?: Precarga) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CalendarioScreen precarga={precarga} /></QueryClientProvider>)
}
const urls = () => mockGet.mock.calls.map(([u]) => String(u))

beforeEach(() => {
  jest.clearAllMocks()
  // Viernes 9 de octubre, 22:30 en Argentina (ya sábado 10 en UTC).
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
  mockGet.mockResolvedValue(EVENTOS)
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('Calendario', () => {
  it('pide la semana argentina de lunes a domingo y muestra los eventos de hoy con su estado', async () => {
    pintar()
    expect(await screen.findByText('Rendir la caja de la semana')).toBeTruthy()
    expect(screen.getByText('Semana del 5 al 11 de octubre')).toBeTruthy()
    expect(screen.getByText('Viernes 9 · hoy')).toBeTruthy()
    expect(urls()).toContain('/api/v1/Calendario?Desde=2026-10-05&Hasta=2026-10-11')
    const cheque = screen.getByLabelText('Cheque de Distribuidora Del Sur, Vencido')
    expect(within(cheque).getByText('Cheque recibido · $ 59.566,01')).toBeTruthy()
    expect(screen.getByLabelText('vie 9, 2 eventos')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('lun 5, 1 evento'))
    expect(screen.getByLabelText('Llamar a Sofía, Hecho')).toBeTruthy()
    expect(screen.queryByText('Rendir la caja de la semana')).toBeNull()
  })

  it('Semana siguiente pide los siete días que siguen', async () => {
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Semana siguiente'))
    expect(await screen.findByText('Semana del 12 al 18 de octubre')).toBeTruthy()
    expect(urls()).toContain('/api/v1/Calendario?Desde=2026-10-12&Hasta=2026-10-18')
  })

  it('"Agendar" recorta el texto precargado a los límites del servidor (150 / 500)', async () => {
    mockPost.mockResolvedValue('id')
    pintar({ titulo: 'T'.repeat(300), descripcion: 'D'.repeat(900), origen: 'A00421' })
    expect((await screen.findByLabelText('Título')).props.value).toHaveLength(150)
    expect(screen.getByLabelText('Título').props.maxLength).toBe(150)
    expect(screen.getByLabelText('Descripción (opcional)').props.maxLength).toBe(500)
    await userEvent.press(screen.getByLabelText('Guardar evento'))
    const body = mockPost.mock.calls[0][1]
    expect(body.titulo).toHaveLength(150)
    expect(body.descripcion).toHaveLength(500)
  })

  it('crea un recordatorio personal: guarda el día (sin hora) y los días de aviso', async () => {
    mockPost.mockResolvedValue('nuevo-id')
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    expect(screen.getByLabelText('Guardar evento').props.accessibilityState.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Título'), 'Pasar a cobrar')
    await userEvent.press(screen.getByLabelText('Día siguiente'))
    expect(screen.getByText('Sábado 10 de octubre')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('3 días antes'))
    await userEvent.press(screen.getByLabelText('Guardar evento'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Calendario/eventos', {
      tipo: 'Manual', titulo: 'Pasar a cobrar', descripcion: null, fechaInicio: '2026-10-10', avisarDiasAntes: 3, visibilidad: 'Personal',
    })
    expect(await screen.findByText('Sábado 10')).toBeTruthy()
  })

  it('en teléfono, el selector "Calendario | Avisos (n)" lleva a la bandeja', async () => {
    const irAAvisos = jest.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><CalendarioScreen avisosSinLeer={5} onIrAAvisos={irAAvisos} /></QueryClientProvider>)
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Avisos (5)'))
    expect(irAAvisos).toHaveBeenCalledTimes(1)
  })

  it('ofrece los tres tipos de la web a cualquier usuario y guarda el elegido', async () => {
    mockPost.mockResolvedValue('nuevo-id')
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    expect(screen.getByLabelText('Otro evento').props.accessibilityState.checked).toBe(true)
    expect(screen.getByLabelText('Servicio (luz, gas, internet…)')).toBeTruthy()
    expect(screen.getByLabelText('Obligación periódica (VTV, impuestos…)')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Obligación periódica (VTV, impuestos…)'))
    await userEvent.type(screen.getByLabelText('Título'), 'VTV de la camioneta')
    await userEvent.press(screen.getByLabelText('Guardar evento'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Calendario/eventos', expect.objectContaining({ tipo: 'ObligacionPeriodica', titulo: 'VTV de la camioneta', visibilidad: 'Personal' }))
  })

  it('"Agendar" desde una venta abre el evento con el título y la descripción cargados', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('El título no puede superar los 200 caracteres.'), { errors: [] }))
    pintar({ titulo: 'Seguir el presupuesto A00421 · Brandsen 3314', descripcion: 'Presupuesto A00421 · $ 178.320,00', origen: 'A00421' })
    expect(await screen.findByText('Viene de la venta A00421: el título y la descripción ya están cargados.')).toBeTruthy()
    expect(screen.getByLabelText('Título').props.value).toBe('Seguir el presupuesto A00421 · Brandsen 3314')
    await userEvent.press(screen.getByLabelText('Guardar evento'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Calendario/eventos', expect.objectContaining({ descripcion: 'Presupuesto A00421 · $ 178.320,00', fechaInicio: '2026-10-09' }))
    // El rechazo del servidor queda a la vista y la hoja sigue abierta.
    expect(await screen.findByText('El título no puede superar los 200 caracteres.')).toBeTruthy()
  })

  it('"Agendar" desde una venta guardada vincula el evento a la venta y guarda la hora', async () => {
    mockPost.mockResolvedValue('nuevo-id')
    pintar({ titulo: 'Seguir el pedido A00341', origen: 'A00341', ventaId: 'venta-341' })
    expect(await screen.findByText('Queda agendado desde la venta A00341: el título y la descripción ya están cargados.')).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Hora (opcional)'), '09:30')
    await userEvent.press(screen.getByLabelText('Guardar evento'))

    expect(mockPost).toHaveBeenCalledWith('/api/v1/Calendario/eventos', expect.objectContaining({ ventaId: 'venta-341', hora: '09:30' }))
  })

  it('una hora mal escrita no deja guardar y lo dice', async () => {
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    await userEvent.type(screen.getByLabelText('Título'), 'Pasar a cobrar')

    await userEvent.type(screen.getByLabelText('Hora (opcional)'), '9:3')

    expect(screen.getByText('Escribí la hora como 09:30.')).toBeTruthy()
    expect(screen.getByLabelText('Guardar evento').props.accessibilityState.disabled).toBe(true)
  })

  it('"Todas las semanas" arranca en el día del evento, suma días y manda la recurrencia semanal', async () => {
    mockPost.mockResolvedValue('nuevo-id')
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    await userEvent.type(screen.getByLabelText('Título'), 'Rendir la caja')

    await userEvent.press(screen.getByLabelText('Todas las semanas'))
    expect(screen.getByText('Se repite todos los viernes')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Lunes'))
    expect(screen.getByText('Se repite todos los lunes y viernes')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Guardar evento'))

    expect(mockPost.mock.calls[0][1].recurrencia).toEqual({ frecuencia: 'Semanal', intervalo: 1, diasSemana: [5, 1] })
  })

  it('el renglón muestra la hora y la venta desde la que se agendó', async () => {
    mockGet.mockResolvedValue([evento({ clave: 'h', fecha: '2026-10-09', titulo: 'Llamar a Marta', hora: '09:30', ventaId: 'v1', ventaCodigo: 'A00341' })])
    pintar()

    expect(await screen.findByText('09:30 · Recordatorio')).toBeTruthy()
    expect(screen.getByText('Agendado desde la venta A00341')).toBeTruthy()
  })

  it('el título de una semana que cruza de mes nombra los dos meses', () => {
    expect(tituloSemana(semanaDe(Date.parse('2026-10-01T15:00:00Z')))).toBe('Semana del 28 de septiembre al 4 de octubre')
  })

  it('al cruzar la medianoche argentina con la pantalla abierta, "hoy" pasa al día nuevo', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-10T02:59:00Z'), doNotFake: ['nextTick', 'queueMicrotask'] })
    pintar()
    expect(await screen.findByText('Viernes 9 · hoy')).toBeTruthy()
    await act(async () => { jest.advanceTimersByTime(61_000) })
    expect(await screen.findByText('Sábado 10 · hoy')).toBeTruthy()
  })

  it('al volver a la pantalla recalcula la semana de hoy', async () => {
    pintar()
    expect(await screen.findByText('Semana del 5 al 11 de octubre')).toBeTruthy()
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-13T15:00:00Z'))
    act(() => { mockAlEnfocar?.() })
    expect(await screen.findByText('Semana del 12 al 18 de octubre')).toBeTruthy()
    expect(screen.getByText('Martes 13 · hoy')).toBeTruthy()
  })
})
