import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { ReportesScreen } from '../ReportesScreen'
import { mesDe, moverMes, tituloMes } from '../mes'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const RESUMEN = {
  anio: 2026,
  mes: 10,
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' },
  vendedorId: 'yo',
  puedeElegirVendedor: false,
  ventas: { facturado: 1250000, operaciones: 5, ticketPromedio: 250000, cobrado: 400000, margenBrutoPorcentaje: null },
  comisiones: { devengado: 60000, reversiones: 5000, neto: 55000, pagado: 20000, saldoActual: 41000 },
  cobrosPendientes: {
    total: 830000,
    clientes: 2,
    detalle: [
      { socioId: 's1', cliente: 'Av. Siempreviva 742 - Kiosco Homero', razonSocial: 'Simpson SRL', deuda: 500000 },
      { socioId: 's2', cliente: 'Calle Falsa 123', razonSocial: 'Flanders SA', deuda: 330000 },
    ],
  },
}

const VENDEDORES = [
  { id: 'v1', nombre: 'Ana Pérez' },
  { id: 'v2', nombre: 'Bruno Díaz' },
]

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ReportesScreen /></QueryClientProvider>)
}
const urls = () => mockGet.mock.calls.map(([u]) => String(u))
const resumenUrls = () => urls().filter((u) => u.includes('resumen-vendedor'))

beforeEach(() => {
  jest.clearAllMocks()
  // 31 de octubre, 22:30 en Argentina: en UTC ya es 1 de noviembre.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-01T01:30:00Z'))
  mockGet.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/Ventas/vendedores') ? VENDEDORES : RESUMEN))
})
afterEach(() => jest.restoreAllMocks())

describe('mes', () => {
  it('el mes en curso es el argentino, no el de UTC', () => {
    expect(mesDe(Date.parse('2026-11-01T01:30:00Z'))).toEqual({ anio: 2026, mes: 10 })
  })

  it('mover cruza el año para los dos lados', () => {
    expect(moverMes({ anio: 2026, mes: 1 }, -1)).toEqual({ anio: 2025, mes: 12 })
    expect(moverMes({ anio: 2026, mes: 12 }, 1)).toEqual({ anio: 2027, mes: 1 })
  })

  it('el título es el mes con mayúscula y el año', () => {
    expect(tituloMes({ anio: 2026, mes: 10 })).toBe('Octubre 2026')
  })
})

describe('Reportes', () => {
  it('el vendedor ve sus ventas, comisiones y cobros pendientes del mes argentino, sin filtro de vendedor', async () => {
    pintar()

    const ventas = await screen.findByTestId('reporte-ventas')
    expect(screen.getByText('Octubre 2026')).toBeTruthy()
    expect(screen.getByText('Mis números')).toBeTruthy()
    expect(resumenUrls()).toEqual(['/api/v1/Reportes/mobile/resumen-vendedor?anio=2026&mes=10'])

    // Las cuatro cifras de la lámina M20, todas del servidor.
    expect(screen.getByLabelText('Vendido: $ 1.250.000,00, 5 ventas')).toBeTruthy()
    expect(screen.getByLabelText('Tu comisión: $ 55.000,00, neto del mes')).toBeTruthy()
    expect(screen.getByLabelText('Cobrado: $ 400.000,00, de estas ventas')).toBeTruthy()
    expect(screen.getByLabelText('Por cobrar: $ 830.000,00, 2 clientes con deuda')).toBeTruthy()
    expect(within(ventas).getByText('Ticket promedio $ 250.000,00')).toBeTruthy()
    // Lo que el servidor no da no se inventa: ni vencido, ni ventas por semana, ni ranking de compradores.
    expect(screen.queryByText(/vencido/i)).toBeNull()
    expect(screen.queryByText(/por semana/i)).toBeNull()
    expect(screen.queryByText(/más te compraron/i)).toBeNull()
    expect(screen.getByText('Reporte básico del vendedor. Los reportes de gestión se ven en la web.')).toBeTruthy()
    // Sin CAP_VER_COSTOS el servidor no manda margen: no se muestra la fila.
    expect(within(ventas).queryByText(/Margen/)).toBeNull()

    const comisiones = screen.getByTestId('reporte-comisiones')
    expect(within(comisiones).getByLabelText('Generado: $ 60.000,00')).toBeTruthy()
    expect(within(comisiones).getByLabelText('Reversiones: $ 5.000,00')).toBeTruthy()
    expect(within(comisiones).getByLabelText('Neto del mes: $ 55.000,00')).toBeTruthy()
    expect(within(comisiones).getByLabelText('Pagado: $ 20.000,00')).toBeTruthy()
    expect(within(comisiones).getByLabelText('A cobrar hoy: $ 41.000,00')).toBeTruthy()

    const cobros = screen.getByTestId('reporte-cobros')
    expect(within(cobros).getByText('Total $ 830.000,00')).toBeTruthy()
    // El cliente se identifica por la dirección; la razón social va aparte.
    const homero = within(cobros).getByLabelText('Av. Siempreviva 742 - Kiosco Homero, debe $ 500.000,00')
    expect(within(homero).getByText('Simpson SRL')).toBeTruthy()

    expect(screen.queryByLabelText(/Vendedor:/)).toBeNull()
    expect(urls().some((u) => u.includes('/Ventas/vendedores'))).toBe(false)
  })

  it('el período ofrece el mes en curso y el anterior, y el anterior pide el mes que corresponde', async () => {
    pintar()
    await screen.findByText('Octubre 2026')
    expect(screen.getByRole('radio', { name: 'Octubre' }).props.accessibilityState).toMatchObject({ checked: true })
    expect(screen.queryByRole('radio', { name: 'Semana' })).toBeNull()

    await userEvent.press(screen.getByRole('radio', { name: 'Septiembre' }))

    expect(await screen.findByText('Septiembre 2026')).toBeTruthy()
    expect(resumenUrls()).toContain('/api/v1/Reportes/mobile/resumen-vendedor?anio=2026&mes=9')
  })

  it('Gerencia ve a todos y puede filtrar por un vendedor', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(
      url.includes('/Ventas/vendedores')
        ? VENDEDORES
        : { ...RESUMEN, puedeElegirVendedor: true, vendedorId: url.includes('vendedorId=v2') ? 'v2' : null }))
    pintar()

    const filtro = await screen.findByLabelText('Vendedor: Todos')
    await userEvent.press(filtro)
    await userEvent.press(await screen.findByRole('radio', { name: 'Bruno Díaz' }))

    expect(await screen.findByLabelText('Vendedor: Bruno Díaz')).toBeTruthy()
    expect(resumenUrls()).toContain('/api/v1/Reportes/mobile/resumen-vendedor?anio=2026&mes=10&vendedorId=v2')

    await userEvent.press(screen.getByLabelText('Vendedor: Bruno Díaz'))
    await userEvent.press(await screen.findByRole('radio', { name: 'Todos' }))
    expect(await screen.findByLabelText('Vendedor: Todos')).toBeTruthy()
  })

  it('con CAP_VER_COSTOS el servidor manda el margen y se muestra', async () => {
    mockGet.mockResolvedValue({ ...RESUMEN, ventas: { ...RESUMEN.ventas, margenBrutoPorcentaje: 32.5 } })
    pintar()

    expect(await screen.findByText('Margen bruto 32,5 %')).toBeTruthy()
  })

  it('si el servidor falla avisa, sin números', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    pintar()

    expect(await screen.findByText('No se pudieron cargar los reportes.')).toBeTruthy()
    expect(screen.queryByTestId('reporte-ventas')).toBeNull()
  })

  it('sin clientes con deuda lo dice', async () => {
    mockGet.mockResolvedValue({ ...RESUMEN, cobrosPendientes: { total: 0, clientes: 0, detalle: [] } })
    pintar()

    expect(await screen.findByText('Ningún cliente de la cartera debe.')).toBeTruthy()
  })
})
