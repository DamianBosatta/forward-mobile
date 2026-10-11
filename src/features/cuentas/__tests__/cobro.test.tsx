import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro, AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { SIN_CUENTA_CONFIRMADA } from '../components/CobroListo'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]

function servidor({ pagoEnNormal = true } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
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

it('el medio cheque no se ofrece mientras el cobro no pueda cargar los datos del cheque', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  expect(await screen.findByRole('radio', { name: 'Efectivo' }, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('radio', { name: 'Cheque' })).toBeNull()
})
