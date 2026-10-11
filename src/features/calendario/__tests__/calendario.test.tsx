import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'
import { semanaDe, tituloSemana } from '../semana'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
}))

const evento = (o: Record<string, unknown>) => ({
  origenId: 'o', origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, ...o,
})
const EVENTOS = [
  evento({ clave: 'a', fecha: '2026-10-09', titulo: 'Rendir la caja de la semana' }),
  evento({ clave: 'b', fecha: '2026-10-09', titulo: 'Cheque de Distribuidora Del Sur', tipo: 'ChequeRecibido', estado: 'Vencido', monto: 59566.01 }),
  evento({ clave: 'c', fecha: '2026-10-05', titulo: 'Llamar a Sofía', estado: 'Pagado' }),
]

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CalendarioScreen /></QueryClientProvider>)
}
const urls = () => mockGet.mock.calls.map(([u]) => String(u))

beforeEach(() => {
  jest.clearAllMocks()
  // Viernes 9 de octubre, 22:30 en Argentina (ya sábado 10 en UTC).
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
  mockGet.mockResolvedValue(EVENTOS)
})
afterEach(() => jest.restoreAllMocks())

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
    expect(screen.getByLabelText('Llamar a Sofía, Pagado')).toBeTruthy()
    expect(screen.queryByText('Rendir la caja de la semana')).toBeNull()
  })

  it('Semana siguiente pide los siete días que siguen', async () => {
    pintar()
    await screen.findByText('Rendir la caja de la semana')
    await userEvent.press(screen.getByLabelText('Semana siguiente'))
    expect(await screen.findByText('Semana del 12 al 18 de octubre')).toBeTruthy()
    expect(urls()).toContain('/api/v1/Calendario?Desde=2026-10-12&Hasta=2026-10-18')
  })

  it('el título de una semana que cruza de mes nombra los dos meses', () => {
    expect(tituloSemana(semanaDe(Date.parse('2026-10-01T15:00:00Z')))).toBe('Semana del 28 de septiembre al 4 de octubre')
  })
})
