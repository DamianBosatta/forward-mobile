import React from 'react'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { AVISO_DEBO_SIN_PERMISO } from '../../../../app/(tabs)/cuentas/index'
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

    await userEvent.press(await screen.findByRole('button', { name: 'Transferir' }, ESPERA))

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/transferencia')
    expect(screen.queryByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeNull()
  })

  it('Transferencia sin permiso se ve deshabilitada, con el motivo, y no navega', async () => {
    renderConQuery(<CuentasCorrientesScreen />)

    const boton = await screen.findByRole('button', { name: 'Transferir' }, ESPERA)
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

    await userEvent.press(await screen.findByRole('button', { name: 'Cobrar' }, ESPERA))

    expect(await screen.findByLabelText('Monto', {}, ESPERA)).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Av\. del Valle 89/ })).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Volver a la cuenta' }))
    expect(await screen.findByLabelText(`Cuenta TST: ${$(132020)}`, {}, ESPERA)).toBeTruthy()
  })
})

it('en el teléfono la barra de abajo sigue a la vista en Cobros (lámina CalleMiDia)', async () => {
  renderConQuery(<CuentasCorrientesScreen />)

  expect(await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Mi día')).toBeTruthy()
})

const RESUMEN_DEUDAS = { clientesConDeuda: 7, totalDeudaClientes: 640300, proveedoresConDeuda: 2, totalDeudaProveedores: 91000 }
const proveedor = (socioId: string, razonSocial: string, saldoDeuda: number) => ({
  socioId, razonSocial, cuit: '30-1-2', saldoDeuda, saldoTst: 0, saldoNormal: saldoDeuda, moneda: 'ARS', puedeVerCuentaCorriente: true,
})

describe('Cuentas: deudas con proveedores y clientes con deuda (MOD_PAGOS:Read)', () => {
  function servidorConDeudas(extra: Record<string, unknown> = {}) {
    const base = get.getMockImplementation()!
    get.mockImplementation(async (url: string) => {
      if (url.includes('/deudas/resumen')) return extra.resumen ?? RESUMEN_DEUDAS
      if (url.includes('/deudas/proveedores')) {
        if (extra.proveedores instanceof Error) throw extra.proveedores
        return extra.proveedores ?? {
          pagina: { page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasNextPage: false, items: [proveedor('p1', 'Molinos SA', 61000), proveedor('p2', 'Lácteos SRL', 30000)] },
          deudaTotal: 91000,
        }
      }
      return base(url)
    })
  }

  it('con MOD_PAGOS:Read el lado "Debo" lista las deudas con proveedores y el total del servidor', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
    servidorConDeudas()
    renderConQuery(<CuentasCorrientesScreen />)
    await screen.findByText('Mostrando 1 de 142', {}, ESPERA)

    await userEvent.press(screen.getByRole('radio', { name: 'Debo' }))

    expect(await screen.findByLabelText(`Molinos SA, le debés ${$(61000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText(`Lácteos SRL, le debés ${$(30000)}`)).toBeTruthy()
    expect(screen.getByLabelText(`Debés: ${$(91000)}`)).toBeTruthy()
    expect(screen.queryByText('Mostrando 1 de 142')).toBeNull()
  })

  it('sin proveedores con deuda dice que no se le debe a nadie', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
    servidorConDeudas({ proveedores: { pagina: { page: 1, totalCount: 0, totalPages: 0, hasNextPage: false, items: [] }, deudaTotal: 0 } })
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Debo' }, ESPERA))

    expect(await screen.findByText('No le debés a ningún proveedor.', {}, ESPERA)).toBeTruthy()
  })

  it('si el servidor falla muestra el error, no una lista vacía', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
    servidorConDeudas({ proveedores: new Error('El servidor no respondió.') })
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Debo' }, ESPERA))

    expect(await screen.findByText('El servidor no respondió.', {}, ESPERA)).toBeTruthy()
  })

  it('sin MOD_PAGOS:Read avisa y no pide las deudas', async () => {
    servidorConDeudas()
    renderConQuery(<CuentasCorrientesScreen />)
    await screen.findByText('Mostrando 1 de 142', {}, ESPERA)

    await userEvent.press(screen.getByRole('radio', { name: 'Debo' }))

    expect(screen.getByText(AVISO_DEBO_SIN_PERMISO)).toBeTruthy()
    expect(get.mock.calls.some(([u]) => String(u).includes('/deudas/'))).toBe(false)
  })

  it('Te deben suma la cantidad de clientes con deuda del resumen', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
    servidorConDeudas()
    const base = get.getMockImplementation()!
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/socios-comerciales?') ? { ...pagina([clienteDeLista()], 142), saldoTotal: 640300 } : base(url)))
    renderConQuery(<CuentasCorrientesScreen />)

    expect(await screen.findByLabelText(`Te deben: ${$(640300)}, 7 clientes con deuda`, {}, ESPERA)).toBeTruthy()
  })

  it('sin MOD_PAGOS:Read Te deben no muestra clientes con deuda', async () => {
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/socios-comerciales?') ? { ...pagina([clienteDeLista()], 142), saldoTotal: 640300 } : fichaConCuentas()))
    renderConQuery(<CuentasCorrientesScreen />)

    expect(await screen.findByLabelText(`Te deben: ${$(640300)}`, {}, ESPERA)).toBeTruthy()
  })
})
