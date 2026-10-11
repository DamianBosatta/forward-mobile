import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro, AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { SIN_CUENTA_CONFIRMADA } from '../components/CobroListo'
import { leerFecha } from '../lib/cobro'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]

const UNA_CAJA = [{ depositoId: 'dep-central', depositoNombre: 'Depósito Central' }]

function servidor({ pagoEnNormal = true, cajas = UNA_CAJA } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') return cajas
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.startsWith('/api/v1/cuentas-corrientes/cNor/movimientos')) {
      return paginaDeMovimientos([mov('n9', '2026-10-11T14:00:00Z', { haber: 86400, pagoId: pagoEnNormal ? 'p1' : 'otro' })])
    }
    if (url.includes('/movimientos')) return paginaDeMovimientos([mov('t1', '2026-09-30T12:00:00Z')])
    return fichaConCuentas()
  })
}

async function cargarMontoYMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  servidor()
  post.mockResolvedValue('p1')
})

it('manda un cobro de una línea sin elegir la cuenta ni imputar: eso lo decide el servidor', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  expect(await screen.findByText(AVISO_IMPUTACION, {}, ESPERA)).toBeTruthy()
  await cargarMontoYMedio('86.400', 'Transferencia')

  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post).toHaveBeenCalledTimes(1)
  const [url, cuerpo] = post.mock.calls[0]
  expect(url).toBe('/api/v1/Finanzas/pagos/multilinea')
  expect(cuerpo).toEqual({ socioComercialId: 'c1', lineas: [{ medioPagoId: 'm-tr', monto: 86400 }] })
  expect(cuerpo).not.toHaveProperty('tipoCuenta')
})

it('al terminar muestra en qué cuenta quedó según los movimientos del servidor', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('86400', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByRole('header', { name: 'Quedó en la cuenta Normal' }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Saldo nuevo')).toBeTruthy()
})

it('si el pago no aparece en ninguna cuenta, no inventa una: lo dice', async () => {
  servidor({ pagoEnNormal: false })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText(SIN_CUENTA_CONFIRMADA, {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText(/Quedó en la cuenta/)).toBeNull()
})

it('con cheque pide sus datos y los manda como cheque recibido, con las fechas del día argentino', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('30.000', 'Cheque')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(screen.getByText('Completá número, banco y titular del cheque.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '00412377')
  fireEvent.changeText(screen.getByLabelText('Banco'), 'Banco Provincia')
  fireEvent.changeText(screen.getByLabelText('Titular'), 'Graciela Ruiz')
  fireEvent.changeText(screen.getByLabelText('Fecha de emisión'), '7/10/2026')
  fireEvent.changeText(screen.getByLabelText('Fecha de pago'), '20/10/2026')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1].lineas).toEqual([{
    medioPagoId: 'm-ch',
    monto: 30000,
    chequesRecibidos: [{ numero: '00412377', banco: 'Banco Provincia', titular: 'Graciela Ruiz', fechaEmision: '2026-10-07', fechaPago: '2026-10-20', monto: 30000 }],
  }])
})

it('si el servidor rechaza, se ve su motivo y el cobro no se da por hecho', async () => {
  post.mockRejectedValue(Object.assign(new Error('No hay una caja abierta.'), { errors: [] }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText('No hay una caja abierta.', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText('Saldo nuevo')).toBeNull()
})

it('mientras se registra, un segundo toque no manda otro cobro', async () => {
  let terminar: (v: string) => void = () => {}
  post.mockImplementation(() => new Promise(r => { terminar = r }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  const boton = screen.getByRole('button', { name: /^Registrar cobro de/ })

  await userEvent.press(boton)
  await userEvent.press(boton)
  terminar('p1')

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
})

it('lee fechas dd/mm/aaaa y rechaza las que no existen', () => {
  expect(leerFecha('07/10/2026')).toBe('2026-10-07')
  expect(leerFecha('31/02/2026')).toBeNull()
  expect(leerFecha('2026-10-07')).toBeNull()
})

it('un cobro en efectivo manda el depósito de la única caja abierta', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1]).toEqual({ socioComercialId: 'c1', depositoId: 'dep-central', lineas: [{ medioPagoId: 'm-ef', monto: 5000 }] })
})

it('con dos cajas abiertas obliga a elegir la caja y manda esa', async () => {
  servidor({ cajas: [...UNA_CAJA, { depositoId: 'dep-sur', depositoNombre: 'Depósito Sur' }] })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(screen.getByText('Elegí en qué caja entra el efectivo.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  await userEvent.press(await screen.findByRole('radio', { name: 'Depósito Sur' }, ESPERA))
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1].depositoId).toBe('dep-sur')
})

it('un medio que no va a caja no manda depósito', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Transferencia')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1]).not.toHaveProperty('depositoId')
})
