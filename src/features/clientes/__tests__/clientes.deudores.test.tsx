import React from 'react'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import { FichaCliente } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { estadoDeCuenta, fichaConCuentas } from '@/features/cuentas/__testing__/servidor'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

// Pedido del dueño (tarea 3): "en la solapa cliente podemos sumar un filtro que diga deudores y que se vea los clientes
// que tienen deuda y tocando podamos entrar a su cuenta corriente y ver la deuda y exportar resumen de lo que debe en
// pdf por whatsapp".

const mockPush = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: 'http://api.test' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
const mockSharePdf = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockSharePdf(...a) }))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(20_000)

const deudor = {
  socioId: 'c1',
  razonSocial: 'Graciela Ruiz',
  cuit: '27243891563',
  saldoDeuda: 186420,
  saldoTst: 132020,
  saldoNormal: 54400,
  moneda: 'ARS',
  puedeVerCuentaCorriente: true,
  diasDeudaMasVieja: 40,
  vendedorId: 'v1',
  vendedorNombre: 'Lucía Ferreyra',
}
const deudas = {
  pagina: { items: [deudor], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNextPage: false },
  deudaTotal: 186420,
}

const CON_DEUDAS = [
  { module: 'MOD_CLIENTES', canRead: true, canCreate: true },
  { module: 'MOD_PAGOS', canRead: true },
  { module: 'MOD_CC', canRead: true },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockSharePdf.mockResolvedValue({ ok: true })
  conPermisos(CON_DEUDAS)
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/deudas/clientes')) return deudas
    if (url.startsWith('/api/v1/socios-comerciales?')) return pagina([clienteDeLista()], 142)
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
})

describe('Clientes: filtro Deudores', () => {
  it('ofrece "Deudores" y muestra solo los clientes que deben, sin la cartera completa', async () => {
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')

    await userEvent.press(screen.getByRole('button', { name: 'Deudores' }))

    expect(await screen.findByText('Graciela Ruiz', undefined, ESPERA)).toBeTruthy()
    expect(screen.getByText(/1 cliente debe/)).toBeTruthy()
    expect(screen.queryByText('Av. del Valle 89')).toBeNull()
    expect(get.mock.calls.some(([u]) => String(u).startsWith('/api/v1/deudas/clientes'))).toBe(true)
  })

  it('tocar un deudor abre su cuenta corriente', async () => {
    renderConQuery(<ClientesScreen />)
    await userEvent.press(await screen.findByRole('button', { name: 'Deudores' }, ESPERA))

    await userEvent.press(await screen.findByText('Graciela Ruiz', undefined, ESPERA))

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/[id]', params: { id: 'c1' } })
  })

  it('el estado de cuenta se comparte en PDF desde la fila del deudor', async () => {
    renderConQuery(<ClientesScreen />)
    await userEvent.press(await screen.findByRole('button', { name: 'Deudores' }, ESPERA))

    await userEvent.press(await screen.findByLabelText('Estado de cuenta de Graciela Ruiz', {}, ESPERA))
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir' }, ESPERA))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const [url, nombre] = mockSharePdf.mock.calls[0] as [string, string]
    expect(url).toContain('/cuentas-corrientes/socios/c1/estado-cuenta/export?formato=Pdf')
    expect(nombre).toMatch(/^estado-cuenta-graciela-ruiz-\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  it('"Mi cartera" vuelve a la lista completa', async () => {
    renderConQuery(<ClientesScreen />)
    await userEvent.press(await screen.findByRole('button', { name: 'Deudores' }, ESPERA))
    await screen.findByText('Graciela Ruiz', undefined, ESPERA)

    await userEvent.press(screen.getByRole('button', { name: 'Mi cartera' }))

    expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
  })

  it('sin permiso de deudas (MOD_PAGOS) no se ofrece el filtro', async () => {
    conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')

    expect(screen.queryByRole('button', { name: 'Deudores' })).toBeNull()
  })
})

describe('Clientes: abrir directo en Deudores (?filtro=deudores)', () => {
  it('con el parametro y permiso, abre en la vista de deudores', async () => {
    mockParams = { filtro: 'deudores' }
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Graciela Ruiz', undefined, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Av. del Valle 89')).toBeNull()
  })

  it('con el parametro pero sin permiso de deudas, lo ignora y muestra la cartera', async () => {
    mockParams = { filtro: 'deudores' }
    conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
    expect(get.mock.calls.some(([u]) => String(u).startsWith('/api/v1/deudas/clientes'))).toBe(false)
  })
})

describe('Ficha del cliente: estado de cuenta', () => {
  it('la solapa Cuenta ofrece compartir el estado de cuenta', async () => {
    renderConQuery(<FichaCliente id="c1" />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Cuenta' }, ESPERA))

    await userEvent.press(await screen.findByRole('button', { name: 'Estado de cuenta' }, ESPERA))
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir' }, ESPERA))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
  })
})
