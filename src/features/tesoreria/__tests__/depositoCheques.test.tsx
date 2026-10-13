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
const cheque = (id: string, banco: string, numero: string, montoAmount: number, extra: Record<string, unknown> = {}) => ({
  id, banco, numero, montoAmount, titular: 'Graciela Ruiz', tipo: 'Tercero', estado: 'EnCartera',
  fechaEmision: '2026-09-01T03:00:00Z', fechaPago: '2026-10-05T03:00:00Z', activo: true, puedeVerDetalle: true,
  ...extra,
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

describe('cliente que entregó el cheque (forward-system #897)', () => {
  const conCheques = (...items: ReturnType<typeof cheque>[]) =>
    get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/v1/cheques?')) return pagina(items, items.length)
      if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [galicia]
      throw new Error(`sin respuesta para ${url}`)
    })

  it('con el servidor nuevo, cada cheque muestra el nombre del cliente y, aparte, su dirección', async () => {
    conCheques(
      cheque('k1', 'Banco Nación', '00871234', 86400, { socioComercialOrigenNombre: 'Kiosco Chela', socioComercialOrigenDireccion: 'Av. del Valle 89' }),
      cheque('k2', 'Banco Macro', '12093345', 1, { socioComercialOrigenNombre: 'Panadería Lucero', socioComercialOrigenDireccion: 'Brandsen 3314' }),
    )
    renderConQuery(<DepositoCheques />)

    expect(await screen.findByText('De Kiosco Chela', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Av. del Valle 89')).toBeTruthy()
    expect(screen.getByText('De Panadería Lucero')).toBeTruthy()
    expect(screen.getByText('Brandsen 3314')).toBeTruthy()
    // El lector de pantalla también las oye, y no hace falta pedir el cliente cheque por cheque.
    expect(screen.getByRole('checkbox', { name: /^Banco Nación/ }).props.accessibilityLabel).toMatch(/, de Kiosco Chela, Av\. del Valle 89$/)
    expect(get.mock.calls.map(([u]) => u).filter((u: string) => !u.startsWith('/api/v1/cheques?') && !u.startsWith('/api/v1/cuentas-corrientes/propias'))).toEqual([])
  })

  it('si la dirección viene null o en blanco, muestra solo el nombre', async () => {
    conCheques(
      cheque('k1', 'Banco Nación', '00871234', 86400, { socioComercialOrigenNombre: 'Kiosco Chela', socioComercialOrigenDireccion: null }),
      cheque('k2', 'Banco Macro', '12093345', 1, { socioComercialOrigenNombre: 'Panadería Lucero', socioComercialOrigenDireccion: '  ' }),
    )
    renderConQuery(<DepositoCheques />)

    expect(await screen.findByText('De Kiosco Chela', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('De Panadería Lucero')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /^Banco Nación/ }).props.accessibilityLabel).toMatch(/, de Kiosco Chela$/)
    expect(screen.getByRole('checkbox', { name: /^Banco Macro/ }).props.accessibilityLabel).toMatch(/, de Panadería Lucero$/)
    // Nada de «Sin dirección cargada» ni líneas vacías: sin dirección no hay segunda línea.
    expect(screen.queryByText(/Sin dirección/)).toBeNull()
    expect(within(screen.getByRole('checkbox', { name: /^Banco Nación/ })).getAllByText(/./)).toHaveLength(4)
  })

  it('con un servidor anterior (sin los campos) o un cheque sin cliente de origen, la fila queda como hoy', async () => {
    conCheques(
      cheque('k1', 'Banco Nación', '00871234', 86400),
      cheque('k2', 'Banco Macro', '12093345', 1, { socioComercialOrigenNombre: null, socioComercialOrigenDireccion: null }),
    )
    renderConQuery(<DepositoCheques />)

    const fila = await screen.findByRole('checkbox', { name: /^Banco Nación/ }, ESPERA)
    expect(screen.queryByText(/^De /)).toBeNull()
    // Banco y número, titular con la fecha, e importe: nada más.
    expect(within(fila).getAllByText(/./)).toHaveLength(3)
    expect(fila.props.accessibilityLabel).toMatch(/^Banco Nación · N\.º 00871234, .+, (Al día|Pago diferido) · [^,]+$/)
    expect(within(screen.getByRole('checkbox', { name: /^Banco Macro/ })).getAllByText(/./)).toHaveLength(3)
  })
})
