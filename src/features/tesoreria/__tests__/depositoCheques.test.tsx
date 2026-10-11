import React from 'react'
import { screen, userEvent, within } from '@testing-library/react-native'
import { DepositoCheques } from '../components/DepositoCheques'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { AppRole } from '@/libs/api-client/types'
import { conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const cheque = (id: string, banco: string, numero: string, montoAmount: number) => ({
  id, banco, numero, montoAmount, titular: 'Graciela Ruiz', tipo: 'Tercero', estado: 'EnCartera',
  fechaEmision: '2026-09-01T03:00:00Z', fechaPago: '2026-10-05T03:00:00Z', activo: true, puedeVerDetalle: true,
})
const galicia = { id: 'gal', nombre: 'Banco Galicia', saldoActual: 0, esPrincipal: false, activo: true, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false, puedeVerMovimientos: true }

function comoRol(rol: AppRole, pagos: { canRead?: boolean; canUpdate?: boolean; canCreate?: boolean }) {
  conPermisos([{ module: 'MOD_PAGOS', ...pagos }, { module: 'MOD_CC', canRead: true }])
  useAuthStore.setState(s => ({ user: { ...s.user!, roles: [rol] } }))
}

async function elegirYDepositar(...nombres: RegExp[]) {
  for (const n of nombres) await userEvent.press(await screen.findByRole('checkbox', { name: n }, ESPERA))
  await userEvent.press(within(screen.getByLabelText('Depositar en')).getByRole('radio', { name: /^Banco Galicia/ }))
  await userEvent.press(screen.getByRole('button', { name: /^Depositar \d+ cheque/ }))
}

beforeEach(() => {
  jest.clearAllMocks()
  comoRol('Gerencia', { canRead: true, canUpdate: true })
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/cheques?')) return pagina([cheque('k1', 'Banco Nación', '00871234', 86400), cheque('k2', 'Banco Macro', '12093345', 128760.5)], 2)
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [galicia]
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue('ok')
})

it('pide solo los cheques de terceros en cartera y deposita cada elegido con su propia llamada', async () => {
  renderConQuery(<DepositoCheques />)
  await elegirYDepositar(/^Banco Nación/, /^Banco Macro/)

  expect(get.mock.calls.map(([u]) => u)).toContain('/api/v1/cheques?Estado=EnCartera&Tipo=Tercero&PageNumber=1&PageSize=100')
  expect(post.mock.calls).toEqual([
    ['/api/v1/cheques/k1/depositar', { chequeId: 'k1', cuentaDestinoId: 'gal' }],
    ['/api/v1/cheques/k2/depositar', { chequeId: 'k2', cuentaDestinoId: 'gal' }],
  ])
  expect(await screen.findByText('Cheques depositados', {}, ESPERA)).toBeTruthy()
})

it('si uno falla, dice exactamente cuál no se depositó (con el motivo) y cuál sí', async () => {
  post.mockImplementation(async (url: string) => {
    if (url.includes('k2')) throw new Error('El cheque tiene fecha de pago diferida al 20/10/2026; no puede depositarse antes de esa fecha.')
    return 'ok'
  })
  renderConQuery(<DepositoCheques />)
  await elegirYDepositar(/^Banco Nación/, /^Banco Macro/)

  expect(await screen.findByText('No se depositaron 1 de 2', {}, ESPERA)).toBeTruthy()
  expect(screen.getByText(/Banco Macro · N\.º 12093345: El cheque tiene fecha de pago diferida/)).toBeTruthy()
  expect(screen.getByText('Sí se depositaron')).toBeTruthy()
  expect(screen.getByText('Banco Nación · N.º 00871234')).toBeTruthy()
  expect(screen.queryByText('Cheques depositados')).toBeNull()
})

it('sin cuenta elegida no se manda nada', async () => {
  renderConQuery(<DepositoCheques />)
  await userEvent.press(await screen.findByRole('checkbox', { name: /^Banco Nación/ }, ESPERA))
  await userEvent.press(screen.getByRole('button', { name: 'Depositar 1 cheque' }))

  expect(post).not.toHaveBeenCalled()
})

it('Depositar cheques se ofrece solo a los roles de la cartera con permiso para modificar pagos', async () => {
  comoRol('Empleado', { canRead: true, canUpdate: true, canCreate: true })
  const { unmount } = renderConQuery(<TesoreriaScreen />)
  expect(await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Depositar cheques' })).toBeNull()
  unmount()

  comoRol('Gerencia', { canRead: true, canUpdate: true })
  renderConQuery(<TesoreriaScreen />)
  expect(await screen.findByRole('button', { name: 'Depositar cheques' }, ESPERA)).toBeTruthy()
})

it('Depositar cheques exige también poder leer pagos y cuentas corrientes', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canUpdate: true }, { module: 'MOD_CC', canRead: true }])
  useAuthStore.setState(s => ({ user: { ...s.user!, roles: ['Gerencia'] } }))
  const { unmount } = renderConQuery(<TesoreriaScreen />)
  expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
  unmount()

  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canUpdate: true }])
  useAuthStore.setState(s => ({ user: { ...s.user!, roles: ['Gerencia'] } }))
  renderConQuery(<TesoreriaScreen />)
  expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
})

it('si hay más cheques que una página, dice cuántos muestra de cuántos y deja cargar el resto', async () => {
  get.mockImplementation(async (url: string) => {
    if (url.includes('PageNumber=2')) return { items: [cheque('k3', 'Banco Ciudad', '555', 1000)], page: 2, pageSize: 100, totalCount: 3, totalPages: 2, hasNextPage: false }
    if (url.startsWith('/api/v1/cheques?')) return { items: [cheque('k1', 'Banco Nación', '00871234', 86400), cheque('k2', 'Banco Macro', '12093345', 1)], page: 1, pageSize: 100, totalCount: 3, totalPages: 2, hasNextPage: true }
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [galicia]
    throw new Error(`sin respuesta para ${url}`)
  })
  renderConQuery(<DepositoCheques />)
  expect(await screen.findByText('Mostrando 2 de 3', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: /^Banco Ciudad/ })).toBeNull()

  await userEvent.press(screen.getByRole('button', { name: 'Cargar más cheques' }))

  expect(await screen.findByRole('checkbox', { name: /^Banco Ciudad/ }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Mostrando 3 de 3')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cargar más cheques' })).toBeNull()
})

it('tras depositar, los cheques que fallaron siguen elegidos y los depositados no', async () => {
  post.mockImplementation(async (url: string) => {
    if (url.includes('k2')) throw new Error('No se puede depositar.')
    return 'ok'
  })
  renderConQuery(<DepositoCheques />)
  await elegirYDepositar(/^Banco Nación/, /^Banco Macro/)
  await screen.findByText('No se depositaron 1 de 2', {}, ESPERA)

  expect(screen.getByRole('checkbox', { name: /^Banco Macro/ }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByRole('checkbox', { name: /^Banco Nación/ }).props.accessibilityState.checked).toBe(false)
  expect(screen.getByRole('button', { name: 'Depositar 1 cheque' })).toBeTruthy()
})
