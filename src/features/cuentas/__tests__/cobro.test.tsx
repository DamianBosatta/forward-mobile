import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro, AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { SIN_CUENTA_CONFIRMADA } from '../components/CobroListo'
import { leerFecha } from '../lib/cobro'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]

const UNA_CAJA = [{ depositoId: 'dep-central', depositoNombre: 'Depósito Central' }]

/** Respuesta del alta del cobro: el id en `data` y lo que el sobre traiga al lado (`tipoCuenta` desde forward-system #868). */
const registrado = (sobre: object = {}) => ({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', ...sobre } })

/** `pagoEn`: la cuenta (`cTst` o `cNor`) cuyos movimientos traen el pago `p1`; con `null`, ninguna. */
function servidor({ pagoEn = 'cNor' as 'cTst' | 'cNor' | null, cajas = UNA_CAJA } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') return cajas
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) {
      const conElPago = !!pagoEn && url.startsWith(`/api/v1/cuentas-corrientes/${pagoEn}/movimientos`)
      return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 86400, pagoId: conElPago ? 'p1' : 'otro' })])
    }
    return fichaConCuentas()
  })
}

const pidioMovimientos = () => get.mock.calls.filter(([url]) => String(url).includes('/movimientos')).map(([url]) => String(url))

async function cargarMontoYMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  servidor()
  post.mockResolvedValue(registrado())
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

it('servidor nuevo: dice la cuenta que trae la respuesta del cobro, sin buscarla en los movimientos', async () => {
  // Los movimientos dirían Normal: si la pantalla los usara en vez de la respuesta, se notaría.
  post.mockResolvedValue(registrado({ tipoCuenta: 'Tst' }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('86400', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByRole('header', { name: 'Quedó en la cuenta TST' }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Saldo nuevo')).toBeTruthy()
  expect(screen.queryByText(SIN_CUENTA_CONFIRMADA)).toBeNull()
  expect(pidioMovimientos()).toEqual([])
})

it.each([
  ['servidor viejo: sin tipoCuenta en la respuesta', {}, 'cNor', 'Normal'],
  // El pago está en TST: si se tomara 'Otra' como cuenta, la pantalla diría Normal sin buscar.
  ['un tipoCuenta que mobile no conoce', { tipoCuenta: 'Otra' }, 'cTst', 'TST'],
] as const)('%s: busca el pago en los movimientos y dice la cuenta donde está', async (_caso, sobre, pagoEn, cuenta) => {
  servidor({ pagoEn })
  post.mockResolvedValue(registrado(sobre))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('86400', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByRole('header', { name: `Quedó en la cuenta ${cuenta}` }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Saldo nuevo')).toBeTruthy()
  expect(pidioMovimientos()).toContainEqual(expect.stringContaining(`/cuentas-corrientes/${pagoEn}/movimientos`))
})

it('un 2xx sin id del pago: el cobro se da por registrado, sin cuenta confirmada y sin buscar en los movimientos', async () => {
  post.mockResolvedValue({ data: undefined, sobre: null })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Transferencia')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText('Cobro registrado', {}, ESPERA)).toBeTruthy()
  expect(await screen.findByText(SIN_CUENTA_CONFIRMADA, {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText(/Quedó en la cuenta/)).toBeNull()
  expect(pidioMovimientos()).toEqual([])
})

it('servidor viejo: si el pago no aparece en ninguna cuenta, no inventa una: lo dice', async () => {
  servidor({ pagoEn: null })
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
  let terminar: (v: unknown) => void = () => {}
  post.mockImplementation(() => new Promise(r => { terminar = r }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  const boton = screen.getByRole('button', { name: /^Registrar cobro de/ })

  await userEvent.press(boton)
  await userEvent.press(boton)
  terminar(registrado())

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

it('con efectivo, no se puede registrar mientras cargan las cajas abiertas: no sale un cobro sin caja', async () => {
  let cargar: (v: unknown) => void = () => {}
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Cajas/abiertas/estado') return new Promise(r => { cargar = r })
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()

  cargar(UNA_CAJA)
  await waitFor(() => expect(screen.getByRole('button', { name: /^Registrar cobro de/ }).props.accessibilityState?.disabled).toBeFalsy(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post.mock.calls[0][1].depositoId).toBe('dep-central')
})

it('si falla la carga de cajas, lo dice con Reintentar y no manda el cobro; al reintentar, cobra con su caja', async () => {
  let falla = true
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Cajas/abiertas/estado') {
      if (falla) throw new Error('No se pudo leer las cajas.')
      return UNA_CAJA
    }
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  expect(await screen.findByText('No se pudo leer las cajas.', {}, ESPERA)).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()

  falla = false
  await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.queryByText('No se pudo leer las cajas.')).toBeNull(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post.mock.calls[0][1].depositoId).toBe('dep-central')
})

it('con efectivo y ninguna caja abierta, avisa y no manda el cobro', async () => {
  servidor({ cajas: [] })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  expect(await screen.findByText('No hay ninguna caja abierta. Abrí una caja para registrar cobros en efectivo.', {}, ESPERA)).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()
})
