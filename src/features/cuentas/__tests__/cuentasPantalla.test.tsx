import React from 'react'
import { screen, userEvent } from '@testing-library/react-native'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
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
