/**
 * Bloque 12, T13c (lienzo R16): Mis números muestra "sin conexión" con el componente de estados de
 * pantalla. Cualquier otro error sigue siendo el aviso de siempre.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import { ReportesScreen } from '../ReportesScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: (url: string) => mockGet(url) } }))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const SIN_RED = () => new TypeError('Network request failed')
const RESUMEN = {
  anio: 2026, mes: 10, periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, vendedorId: 'yo', puedeElegirVendedor: false,
  ventas: { facturado: 1250000, operaciones: 5, ticketPromedio: 250000, cobrado: 400000, margenBrutoPorcentaje: null },
  comisiones: { devengado: 60000, reversiones: 5000, neto: 55000, pagado: 20000, saldoActual: 41000 },
  cobrosPendientes: { total: 0, clientes: 0, detalle: [] },
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ReportesScreen /></QueryClientProvider>)
  return qc
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(RESUMEN)
})

describe('Reportes: sin conexión', () => {
  it('sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    mockGet.mockRejectedValue(SIN_RED())
    pintar()

    expect(await screen.findByRole('header', { name: 'No pudimos cargar los reportes' })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()

    mockGet.mockResolvedValue(RESUMEN)
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('reporte-ventas')).toBeTruthy()
  })

  it('con lo guardado: los números siguen y un aviso dice a qué hora se guardaron', async () => {
    const qc = pintar()
    await screen.findByTestId('reporte-ventas')

    mockGet.mockRejectedValue(SIN_RED())
    await act(async () => { await qc.refetchQueries() })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByTestId('reporte-ventas')).toBeTruthy()
  })

  it('otro error sigue siendo el aviso de siempre', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    pintar()

    expect(await screen.findByText('No se pudieron cargar los reportes.')).toBeTruthy()
    expect(screen.queryByRole('header', { name: 'No pudimos cargar los reportes' })).toBeNull()
  })
})
