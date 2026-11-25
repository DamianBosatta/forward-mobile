import React from 'react'
import { ScrollView } from 'react-native'
import { screen, within } from '@testing-library/react-native'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas } from '../__testing__/servidor'

// MP-23 A (maqueta aprobada 2026-11-24): en el panel de Cuentas en tablet horizontal el cobro usa dos columnas a todo el
// ancho y el pie con "Registrar cobro" queda debajo de los campos, fuera del scroll. Solo disposición: el envío no cambia.

let mockAncho = 1280
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho, height: 800, isTablet: mockAncho >= 600, isTabletLandscape: mockAncho >= 900, scale: (n: number) => n }),
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho = 1280
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return [{ id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true }]
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
})

describe('Cobro en el panel de Cuentas', () => {
  it('tablet horizontal: dos columnas a todo el ancho del panel y el pie debajo de los campos, fuera del scroll', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await screen.findByLabelText('Monto', {}, ESPERA)

    expect(screen.getByText('¿Qué cobrás?')).toBeTruthy()
    expect(screen.getByText('¿Cómo te pagó?')).toBeTruthy()
    expect(screen.getByTestId('cobro-panel')).toBeTruthy()
    expect(screen.queryByTestId('form-container')).toBeNull()
    const scroll = screen.UNSAFE_getByType(ScrollView)
    expect(within(scroll).queryByTestId('cobro-pie')).toBeNull()
    expect(screen.getByRole('button', { name: /^Registrar cobro/ })).toBeTruthy()
  })

  it('teléfono: sigue como hoy, una columna de formulario y el mismo pie', async () => {
    mockAncho = 390
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await screen.findByLabelText('Monto', {}, ESPERA)

    expect(screen.getByTestId('form-container')).toBeTruthy()
    expect(screen.queryByTestId('cobro-panel')).toBeNull()
    expect(screen.queryByText('¿Qué cobrás?')).toBeNull()
    expect(screen.getByRole('button', { name: /^Registrar cobro/ })).toBeTruthy()
  })
})
