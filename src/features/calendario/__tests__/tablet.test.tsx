import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'

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
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const evento = (o: Record<string, unknown>) => ({ origenId: 'o', origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, ...o })
const AVISOS = { items: [{ id: 'n1', tipo: 'VentaAutorizada', severidad: 'Info', presentacion: 'Toast', leida: false, titulo: 'Autorizaron tu pedido A00419', mensaje: 'Tarantino 1898', fechaCreacion: '2026-10-22T15:04:00Z', accion: null }], noLeidas: 1, hayMas: false }

beforeEach(() => {
  jest.clearAllMocks()
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
  it('muestra el mes entero (octubre 2026 arranca un jueves) y pide el rango de la grilla', async () => {
    pintar()
    expect(await screen.findByText('Reunión de vendedores')).toBeTruthy()
    expect(screen.getByText('Octubre 2026')).toBeTruthy()
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Calendario?Desde=2026-09-28&Hasta=2026-11-01')
    expect(screen.getByLabelText('jue 22, 1 evento, hoy').props.accessibilityState.checked).toBe(true)
    expect(screen.getByText('Jueves 22 · hoy')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('lun 5, 1 evento'))
    expect(screen.getByLabelText('Llamar a Sofía, Pendiente')).toBeTruthy()
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
    await userEvent.press(screen.getByLabelText('Mes siguiente'))
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy()
    expect(mockGet.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Calendario?Desde=2026-10-26&Hasta=2026-12-06')
  })

  it('"Nuevo evento" abre la hoja con los tipos', async () => {
    pintar()
    await screen.findByText('Reunión de vendedores')
    await userEvent.press(screen.getByLabelText('Nuevo evento'))
    expect(screen.getByLabelText('Servicio (luz, gas, internet…)')).toBeTruthy()
  })
})
