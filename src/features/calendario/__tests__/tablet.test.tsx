import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'
import { storage } from '@/core/utils/storage'

let mockHorizontal = true
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockHorizontal ? 1194 : 820, isTablet: true, isTabletLandscape: mockHorizontal }),
}))
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: jest.fn() },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const evento = (o: Record<string, unknown>) => ({ origenId: 'o', origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, ...o })
const AVISOS = { items: [{ id: 'n1', tipo: 'VentaAutorizada', severidad: 'Info', presentacion: 'Toast', leida: false, titulo: 'Autorizaron tu pedido A00419', mensaje: 'Tarantino 1898', fechaCreacion: '2026-10-22T15:04:00Z', accion: null }], noLeidas: 1, hayMas: false }

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  mockHorizontal = true
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T15:00:00Z'))
  mockGet.mockImplementation((url: string) =>
    String(url).includes('/Calendario')
      ? Promise.resolve([evento({ clave: 'a', fecha: '2026-10-22', titulo: 'Reunión de vendedores', hora: '10:00' }), evento({ clave: 'b', fecha: '2026-10-05', titulo: 'Llamar a Sofía' })])
      : Promise.resolve(AVISOS))
})
afterEach(() => jest.restoreAllMocks())

const pintar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CalendarioScreen /></QueryClientProvider>)

describe('Calendario y avisos en tablet (TM10)', () => {
  it('muestra lo mismo que el teléfono: abre en la semana de hoy, como la web', async () => {
    pintar()
    expect(await screen.findByText('Reunión de vendedores')).toBeTruthy()
    expect(screen.getByText('19 oct – 25 oct')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Semana' }).props.accessibilityState.checked).toBe(true)
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Calendario?Desde=2026-10-19&Hasta=2026-10-25')
    expect(screen.getByLabelText('Reunión de vendedores, Pendiente')).toBeTruthy()
  })

  it('en horizontal los avisos van al lado, con "Marcar leídos"; en vertical no', async () => {
    pintar()
    const panel = await screen.findByTestId('panel-avisos')
    expect(await within(panel).findByText('Autorizaron tu pedido A00419')).toBeTruthy()
    expect(within(panel).getByText('Avisos · 1')).toBeTruthy()
    expect(within(panel).getByLabelText('Marcar leídos')).toBeTruthy()
  })

  it('en vertical no hay panel de avisos y el mes navega con las flechas', async () => {
    mockHorizontal = false
    pintar()
    await screen.findByText('Reunión de vendedores')
    expect(screen.queryByTestId('panel-avisos')).toBeNull()
    await userEvent.press(screen.getByRole('radio', { name: 'Mes' }))
    expect(await screen.findByText('Octubre de 2026')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Siguiente'))
    expect(await screen.findByText('Noviembre de 2026')).toBeTruthy()
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Calendario?Desde=2026-10-26&Hasta=2026-12-06')
  })

  it('"Nuevo evento" abre la hoja con los tipos', async () => {
    pintar()
    await screen.findByText('Reunión de vendedores')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    expect(screen.getByLabelText('Servicio (luz, gas, internet…)')).toBeTruthy()
  })
})
