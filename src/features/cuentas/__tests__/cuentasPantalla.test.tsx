import React from 'react'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA } from '@/core/ui/fw/MotivoDeshabilitado'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, paginaDeMovimientos } from '../__testing__/servidor'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
const mockHorizontal = jest.fn(() => false)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockHorizontal() ? 1194 : 390, isTablet: mockHorizontal(), isTabletLandscape: mockHorizontal() }),
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

beforeEach(() => {
  jest.clearAllMocks()
  mockHorizontal.mockReturnValue(false)
  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_CLIENTES', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return pagina([clienteDeLista()], 142)
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) return paginaDeMovimientos([])
    return fichaConCuentas()
  })
})

it('lista la cartera por dirección y en el teléfono tocar un cliente abre su cuenta', async () => {
  renderConQuery(<CuentasCorrientesScreen />)

  await userEvent.press(await screen.findByRole('button', { name: /^Av\. del Valle 89, Chela · Kiosco Chela/ }, ESPERA))

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/[id]', params: { id: 'c1' } })
  expect(screen.getByText('Mostrando 1 de 142')).toBeTruthy()
})

it('en tablet horizontal la cuenta se abre al costado, sin salir de la lista', async () => {
  mockHorizontal.mockReturnValue(true)
  renderConQuery(<CuentasCorrientesScreen />)

  await userEvent.press(await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA))

  expect(await screen.findByLabelText(`Cuenta TST: ${$(132020)}`, {}, ESPERA)).toBeTruthy()
  expect(mockPush).not.toHaveBeenCalled()
})

describe('R10 Cuentas corrientes: resumen y transferencia', () => {
  it('Te deben muestra el saldo total que da el servidor', async () => {
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/socios-comerciales?') ? { ...pagina([clienteDeLista()], 142), saldoTotal: 640300 } : fichaConCuentas()))
    renderConQuery(<CuentasCorrientesScreen />)

    expect(await screen.findByLabelText(`Te deben: ${$(640300)}`, {}, ESPERA)).toBeTruthy()
  })

  it('sin saldo total no hay resumen: no se suma en el teléfono', async () => {
    renderConQuery(<CuentasCorrientesScreen />)
    await screen.findByText('Mostrando 1 de 142', {}, ESPERA)

    expect(screen.queryByLabelText(/^Te deben/)).toBeNull()
  })

  it('Transferencia, con MOD_PAGOS crear y leer, abre el movimiento entre cuentas propias', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    renderConQuery(<CuentasCorrientesScreen />)

    await userEvent.press(await screen.findByRole('button', { name: 'Transferencia' }, ESPERA))

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/transferencia')
    expect(screen.queryByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeNull()
  })

  it('Transferencia sin permiso se ve deshabilitada, con el motivo, y no navega', async () => {
    renderConQuery(<CuentasCorrientesScreen />)

    const boton = await screen.findByRole('button', { name: 'Transferencia' }, ESPERA)
    expect(boton.props.accessibilityState?.disabled).toBe(true)
    expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeTruthy()
    await userEvent.press(boton)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('el filtro "Con deuda vencida" lo aplica el servidor', async () => {
    renderConQuery(<CuentasCorrientesScreen />)
    await screen.findByText('Mostrando 1 de 142', {}, ESPERA)

    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))

    await waitFor(() => expect(get.mock.calls.some(([u]) => String(u).includes('conDeudaVencida=true'))).toBe(true), ESPERA)
  })
})

describe('TM9 cobro en el panel (tablet)', () => {
  it('Registrar cobro abre el cobro al costado, sin salir de la lista, y Cancelar vuelve a la cuenta', async () => {
    mockHorizontal.mockReturnValue(true)
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    const anterior = get.getMockImplementation()!
    get.mockImplementation(async (url: string) => (url === '/api/v1/gastos/medios-pago' ? [{ id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true }] : anterior(url)))
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA))

    await userEvent.press(await screen.findByRole('button', { name: 'Registrar cobro' }, ESPERA))

    expect(await screen.findByLabelText('Monto', {}, ESPERA)).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Av\. del Valle 89/ })).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Volver a la cuenta' }))
    expect(await screen.findByLabelText(`Cuenta TST: ${$(132020)}`, {}, ESPERA)).toBeTruthy()
  })
})
