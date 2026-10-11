import React from 'react'
import { screen, userEvent, within } from '@testing-library/react-native'
import { CuentaCorrienteCliente } from '../components/CuentaCorrienteCliente'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
/** La primera pantalla de la suite tarda en montar cuando corre el suite completo en paralelo. */
const ESPERA = { timeout: 5000 }
const urls = () => get.mock.calls.map(([u]) => String(u))

function servidor({ ficha = fichaConCuentas(), tstPaginas = 1 } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.startsWith('/api/v1/cuentas-corrientes/cTst/movimientos')) {
      return url.includes('pageNumber=2')
        ? paginaDeMovimientos([mov('t0', '2026-08-01T12:00:00Z', { referencia: 'Venta A00300 entregada', debe: 5000, saldoHistorico: 5000 })], 2, 2)
        : paginaDeMovimientos([mov('t1', '2026-09-30T12:00:00Z', { referencia: 'Cobro', haber: 66940, saldoHistorico: 132020, medioPagoNombre: 'Transferencia' })], 1, tstPaginas)
    }
    if (url.startsWith('/api/v1/cuentas-corrientes/cNor/movimientos')) {
      return paginaDeMovimientos([mov('n1', '2026-10-02T12:00:00Z', { referencia: 'Venta A00409 entregada', debe: 84400, saldoHistorico: 216420 })])
    }
    return ficha
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_CC', canRead: true }])
  servidor()
})

it('muestra el saldo con el desglose TST / Normal que da el servidor', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)).toBeTruthy()
  expect(screen.getByLabelText(`Cuenta TST: ${$(132020)}`)).toBeTruthy()
  expect(screen.getByLabelText(`Cuenta Normal (con factura): ${$(54400)}`)).toBeTruthy()
  expect(screen.getByLabelText(`Tope de crédito: ${$(300000)}`)).toBeTruthy()
  expect(urls()).toContain('/api/v1/cuentas-corrientes/socios/c1/estado-cuenta')
})

it('los movimientos de las dos cuentas van juntos y cada uno dice en qué cuenta está', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  const venta = await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)
  expect(venta.props.accessibilityLabel).toContain('Cuenta Normal')
  expect(venta.props.accessibilityLabel).toContain(`+ ${$(84400)}`)
  const cobro = screen.getByLabelText(/Cobro/)
  expect(cobro.props.accessibilityLabel).toContain('Cuenta TST')
  expect(cobro.props.accessibilityLabel).toContain(`− ${$(66940)}`)
  expect(within(cobro).getByText('Transferencia')).toBeTruthy()
})

it('con el filtro TST solo quedan los movimientos de esa cuenta', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)

  await userEvent.press(screen.getByRole('radio', { name: 'TST' }))

  expect(screen.getByLabelText(/Cobro/)).toBeTruthy()
  expect(screen.queryByLabelText(/Venta A00409 entregada/)).toBeNull()
})

it('Ver movimientos anteriores pide la página siguiente al servidor', async () => {
  servidor({ tstPaginas: 2 })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(/Cobro/, {}, ESPERA)

  await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos anteriores' }))

  expect(await screen.findByLabelText(/Venta A00300 entregada/, {}, ESPERA)).toBeTruthy()
  expect(urls()).toContain('/api/v1/cuentas-corrientes/cTst/movimientos?pageNumber=2&pageSize=20')
})

it('si el servidor no deja ver la cuenta, no se pide ni el estado ni los movimientos', async () => {
  servidor({ ficha: fichaConCuentas({ puedeVerCuentaCorriente: false, cuentaId: null, cuentaNormalId: null }) })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByText('No tenés acceso a la cuenta corriente de este cliente.', {}, ESPERA)).toBeTruthy()
  expect(urls().some(u => u.includes('estado-cuenta') || u.includes('/movimientos'))).toBe(false)
})

it('si el servidor rechaza los movimientos, se ve su mensaje', async () => {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/movimientos')) throw new Error('No tenés permisos para esta acción.')
    return url.endsWith('/estado-cuenta') ? estadoDeCuenta() : fichaConCuentas()
  })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByText('No tenés permisos para esta acción.', {}, ESPERA)).toBeTruthy()
})
