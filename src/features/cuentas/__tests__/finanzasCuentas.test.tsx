import React from 'react'
import { StyleSheet } from 'react-native'
import { screen, userEvent, within } from '@testing-library/react-native'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, paginaDeMovimientos } from '../__testing__/servidor'

/** Propuesta "Finanzas como venta", frames 1 a 7 (Cuentas: Me deben y Debo). */

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isTablet: mockAncho() >= 600, isTabletLandscape: mockAncho() >= 1000 }),
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

const RESUMEN = { clientesConDeuda: 7, totalDeudaClientes: 640300, proveedoresConDeuda: 2, totalDeudaProveedores: 91000 }
const proveedor = (socioId: string, razonSocial: string, saldoDeuda: number, diasDeudaMasVieja: number | null = null) => ({
  socioId, razonSocial, cuit: '30-1-2', saldoDeuda, saldoTst: 0, saldoNormal: saldoDeuda, moneda: 'ARS', puedeVerCuentaCorriente: true, diasDeudaMasVieja,
})
const PROVEEDORES = {
  pagina: { page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasNextPage: false, items: [proveedor('p1', 'Molinos SA', 61000, 49), proveedor('p2', 'Lácteos SRL', 30000, 27)] },
  deudaTotal: 91000,
}

function servidor(clientes = [clienteDeLista()], extra: { saldoTotal?: number; proveedores?: unknown } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return { ...pagina(clientes, 142), ...(extra.saldoTotal !== undefined ? { saldoTotal: extra.saldoTotal } : {}) }
    if (url.includes('/deudas/resumen')) return RESUMEN
    if (url.includes('/deudas/proveedores')) return extra.proveedores ?? PROVEEDORES
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) return paginaDeMovimientos([])
    return fichaConCuentas()
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_CLIENTES', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
  servidor()
})

describe('Me deben (frames 1 y 2)', () => {
  it('"Te deben" es un hero con la cifra grande y "N clientes con deuda" debajo', async () => {
    servidor([clienteDeLista()], { saldoTotal: 640300 })
    renderConQuery(<CuentasCorrientesScreen />)

    const hero = await screen.findByTestId('hero-saldo', {}, ESPERA)
    expect(within(hero).getByText('Te deben')).toBeTruthy()
    expect(within(hero).getByText($(640300))).toBeTruthy()
    expect(await within(hero).findByText('7 clientes con deuda', {}, ESPERA)).toBeTruthy()
    expect(within(hero).getByLabelText(`Te deben: ${$(640300)}, 7 clientes con deuda`)).toBeTruthy()
  })

  it('cada fila lleva las iniciales de la dirección, el saldo y la flecha porque abre la cuenta', async () => {
    renderConQuery(<CuentasCorrientesScreen />)

    const fila = await screen.findByRole('button', { name: /^Av\. del Valle 89, Chela · Kiosco Chela/ }, ESPERA)
    expect(within(fila).getByText('AD')).toBeTruthy()
    expect(within(fila).getByText($(186420))).toBeTruthy()
    expect(within(fila).getByTestId('fila-chevron')).toBeTruthy()
  })

  it('cartera ajena: el candado del saldo lleva el texto "Saldo reservado" y la pastilla de otro vendedor', async () => {
    servidor([clienteDeLista({ puedeVerSaldo: false, saldoAmount: 0 })])
    renderConQuery(<CuentasCorrientesScreen />)

    const fila = await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA)
    expect(within(fila).getByText('Saldo reservado')).toBeTruthy()
    expect(within(fila).getByText('Cartera de otro vendedor')).toBeTruthy()
  })

  it('"Transferir" es solo ícono en el teléfono y lleva el texto desde 600 px', async () => {
    renderConQuery(<CuentasCorrientesScreen />)
    expect(await screen.findByRole('button', { name: 'Transferir' }, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Transferir')).toBeNull()

    screen.unmount()
    mockAncho.mockReturnValue(768)
    renderConQuery(<CuentasCorrientesScreen />)
    expect(await screen.findByText('Transferir', {}, ESPERA)).toBeTruthy()
  })

  it('el chip "Con deuda vencida" mide 44 y lleva tilde cuando está activo', async () => {
    renderConQuery(<CuentasCorrientesScreen />)
    const chip = await screen.findByRole('button', { name: 'Con deuda vencida' }, ESPERA)
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(44)
    expect(within(chip).queryByTestId('chip-tilde')).toBeNull()

    await userEvent.press(chip)

    expect(within(screen.getByRole('button', { name: 'Con deuda vencida' })).getByTestId('chip-tilde')).toBeTruthy()
  })

  it('cargando: esqueletos con la forma del hero y de las filas en lugar de la ruedita', async () => {
    get.mockImplementation(() => new Promise(() => {}))
    renderConQuery(<CuentasCorrientesScreen />)

    expect(await screen.findByTestId('esqueleto-hero', {}, ESPERA)).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila').length).toBeGreaterThan(0)
    expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(0)
  })
})

describe('Debo (frames 6 y 7)', () => {
  it('"Debés" es un hero con la cifra grande y cada proveedor va en una fila sin flecha (solo lectura)', async () => {
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Debo' }, ESPERA))

    const hero = await screen.findByTestId('hero-saldo', {}, ESPERA)
    expect(within(hero).getByText('Debés')).toBeTruthy()
    expect(within(hero).getByLabelText(`Debés: ${$(91000)}`)).toBeTruthy()
    const fila = screen.getByLabelText(`Molinos SA, le debés ${$(61000)}, Vencida · 49 días`)
    expect(within(fila).getByText($(61000))).toBeTruthy()
    expect(within(fila).queryByTestId('fila-chevron')).toBeNull()
    expect(screen.queryByRole('button', { name: /Molinos SA/ })).toBeNull()
  })

  it('cargando: esqueleto del hero y de una fila', async () => {
    const base = get.getMockImplementation()!
    get.mockImplementation((url: string) => (url.includes('/deudas/proveedores') ? new Promise(() => {}) : base(url)))
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Debo' }, ESPERA))

    expect(await screen.findByTestId('esqueleto-hero', {}, ESPERA)).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(1)
  })
})
