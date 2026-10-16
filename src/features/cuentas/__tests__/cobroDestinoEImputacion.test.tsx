import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro, AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { IMPUTADO_DE_MAS } from '../lib/cobro'
import { api, ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, movSocio, paginaDeMovimientos, paginaDeMovimientosSocio } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))
const mockCamara = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: () => mockCamara(),
  launchImageLibraryAsync: () => mockCamara(),
}))

const get = api.get as jest.Mock
const subir = api.post as jest.Mock
const registrar = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true, cuentaPropiaDefaultId: 'cp-galicia' },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]
const cuentaPropia = (id: string, nombre: string, extra: object = {}) => ({
  id, nombre, activo: true, esPrincipal: false, tipo: 'Tst', saldoActual: 0, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false, puedeVerMovimientos: true, ...extra,
})
const PROPIAS = [
  cuentaPropia('cp-galicia', 'Galicia'),
  cuentaPropia('cp-mp', 'Mercado Pago'),
  cuentaPropia('cp-caja', 'Caja central', { esCuentaCajaEfectivo: true }),
]
const PENDIENTES = [
  { documentoId: 'v-409', codigoPedido: 'A00409', fecha: '2026-10-01T12:00:00Z', total: 50000, saldoPendiente: 50000, tipoCuenta: 'Tst', tipo: 'Venta' },
  { documentoId: 'v-410', codigoPedido: 'A00410', fecha: '2026-10-05T12:00:00Z', total: 40000, saldoPendiente: 30000, tipoCuenta: 'Tst', tipo: 'Venta' },
]

const pidio = (parte: string) => get.mock.calls.some(([url]) => String(url).includes(parte))

/** La lista liviana (`propias/para-cobrar`): sin saldos. */
const PARA_COBRAR = PROPIAS.map(({ id, nombre, esPrincipal, esCuentaCajaEfectivo, esCuentaCarteraCheques }) =>
  ({ id, nombre, moneda: 'ARS', esPrincipal, esCuentaCajaEfectivo, esCuentaCarteraCheques }))
const VIEJO = new ApiError(404, 'No encontrado')

function servidor({
  propias = PROPIAS as unknown,
  paraCobrar = PARA_COBRAR as unknown,
  imputadoA = [] as { comprobante: string; monto: number }[],
  pago = null as unknown,
} = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/cuentas-corrientes/propias/para-cobrar') {
      if (paraCobrar instanceof Error) throw paraCobrar
      return paraCobrar
    }
    if (url === '/api/v1/Pagos/p1') {
      if (!pago) throw VIEJO
      if (pago instanceof Error) throw pago
      return pago
    }
    if (url === '/api/v1/cuentas-corrientes/propias') {
      if (propias instanceof Error) throw propias
      return propias
    }
    if (url.startsWith('/api/v1/deudas/socios/c1/pendientes')) return PENDIENTES
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.startsWith('/api/v1/cuentas-corrientes/socios/c1/movimientos')) {
      return paginaDeMovimientosSocio([movSocio('m1', '2026-10-11T14:00:00Z', { tipo: 'Pago', haber: 86400, imputadoA })])
    }
    if (url.includes('/movimientos')) return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 86400, pagoId: 'p1' })])
    return fichaConCuentas()
  })
}

async function cargarMontoYMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
}
const tocarRegistrar = () => userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
const cuerpo = () => registrar.mock.calls[0][1]

const PAGOS = { module: 'MOD_PAGOS', canRead: true, canCreate: true }
const CC = { module: 'MOD_CC', canRead: true }

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([PAGOS])
  servidor()
  registrar.mockResolvedValue({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', tipoCuenta: 'Tst' } })
  let n = 0
  mockCamara.mockImplementation(async () => ({ canceled: false, assets: [{ uri: `file:///foto-${++n}.jpg` }] }))
  subir.mockImplementation(async (url: string) => ({ url: `https://r2.forward/${url.split('/').pop()}/foto.jpg` }))
})

describe('cuenta donde entró', () => {
  it('quien cobra (MOD_PAGOS:Create, sin MOD_CC:Read) elige la cuenta propia de la lista liviana y la manda en la línea', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')

    // La del medio se ve marcada; la caja de efectivo no es una cuenta donde entra una transferencia.
    const galicia = await screen.findByRole('radio', { name: 'Galicia' }, ESPERA)
    expect(galicia.props.accessibilityState.checked).toBe(true)
    expect(screen.queryByRole('radio', { name: 'Caja central' })).toBeNull()
    await userEvent.press(screen.getByRole('radio', { name: 'Mercado Pago' }))
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(cuerpo().lineas).toEqual([{ medioPagoId: 'm-tr', monto: 86400, cuentaPropiaId: 'cp-mp' }])
    expect(pidio('/api/v1/cuentas-corrientes/propias/para-cobrar')).toBe(true)
    expect(get.mock.calls.some(([url]) => url === '/api/v1/cuentas-corrientes/propias')).toBe(false)
  })

  it('con un servidor anterior (404) y MOD_CC:Read usa la lista de cuentas propias de siempre', async () => {
    conPermisos([PAGOS, CC])
    servidor({ paraCobrar: VIEJO })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await userEvent.press(await screen.findByRole('radio', { name: 'Mercado Pago' }, ESPERA))
    expect(screen.queryByRole('radio', { name: 'Caja central' })).toBeNull()
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(cuerpo().lineas).toEqual([{ medioPagoId: 'm-tr', monto: 86400, cuentaPropiaId: 'cp-mp' }])
  })

  it('con un servidor anterior y sin MOD_CC:Read no hay lista ni cuenta: el servidor usa la del medio, como antes', async () => {
    servidor({ paraCobrar: VIEJO })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await waitFor(() => expect(pidio('/propias/para-cobrar')).toBe(true))
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(get.mock.calls.some(([url]) => url === '/api/v1/cuentas-corrientes/propias')).toBe(false)
    expect(screen.queryByText('Cuenta donde entró')).toBeNull()
    expect(cuerpo().lineas).toEqual([{ medioPagoId: 'm-tr', monto: 86400 }])
  })

  it('si la lista de cuentas falla, no se elige y el cobro sale igual', async () => {
    servidor({ paraCobrar: new Error('No tenés permiso.') })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await waitFor(() => expect(pidio('/propias/para-cobrar')).toBe(true))
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Cuenta donde entró')).toBeNull()
    expect(cuerpo().lineas).toEqual([{ medioPagoId: 'm-tr', monto: 86400 }])
  })
})

describe('fotos', () => {
  it('la foto del comprobante se sube a upload-comprobante y su URL va en el cobro', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await userEvent.press(await screen.findByRole('button', { name: 'Sacar foto del comprobante' }, ESPERA))
    expect(await screen.findByText('Foto del comprobante cargada', {}, ESPERA)).toBeTruthy()
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(subir.mock.calls[0][0]).toBe('/api/v1/Media/upload-comprobante')
    expect(cuerpo().comprobanteUrl).toBe('https://r2.forward/upload-comprobante/foto.jpg')
  })

  it('gestión sube la foto del cheque a upload-cheque y va en el cheque recibido', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'g', email: 'g@x.com', roles: ['Gerencia'], permissions: [PAGOS] } as never })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('30.000', 'Cheque')
    fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '00412377')
    fireEvent.changeText(screen.getByLabelText('Banco'), 'Banco Provincia')
    fireEvent.changeText(screen.getByLabelText('Titular'), 'Graciela Ruiz')
    await userEvent.press(screen.getByRole('button', { name: 'Sacar foto del cheque' }))
    expect(await screen.findByText('Foto del cheque cargada', {}, ESPERA)).toBeTruthy()
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(subir.mock.calls[0][0]).toBe('/api/v1/Media/upload-cheque')
    expect(cuerpo().lineas[0].chequesRecibidos[0].imagenUrl).toBe('https://r2.forward/upload-cheque/foto.jpg')
  })

  it('quien cobra (MOD_PAGOS:Create), aunque no sea gestión, sube la foto del cheque a upload-cheque', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('30.000', 'Cheque')
    await userEvent.press(await screen.findByRole('button', { name: 'Sacar foto del cheque' }, ESPERA))
    expect(await screen.findByText('Foto del cheque cargada', {}, ESPERA)).toBeTruthy()

    expect(subir.mock.calls[0][0]).toBe('/api/v1/Media/upload-cheque')
  })
})

describe('imputación', () => {
  it('por defecto es automática: no pide los pendientes ni manda imputaciones', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    expect(await screen.findByText(AVISO_IMPUTACION, {}, ESPERA)).toBeTruthy()
    await cargarMontoYMedio('86.400', 'Transferencia')
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(pidio('/pendientes')).toBe(false)
    expect(cuerpo()).not.toHaveProperty('imputaciones')
  })

  it('manual: se eligen los comprobantes y cada uno va con su monto', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('60.000', 'Transferencia')
    await userEvent.press(screen.getByRole('radio', { name: 'Elegir comprobantes' }))
    await userEvent.press(await screen.findByRole('checkbox', { name: 'A00409, pendiente $ 50.000,00' }, ESPERA))
    await userEvent.press(screen.getByRole('checkbox', { name: 'A00410, pendiente $ 30.000,00' }))
    fireEvent.changeText(screen.getByLabelText('Monto a imputar a A00410'), '10.000')
    await tocarRegistrar()

    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    expect(cuerpo().imputaciones).toEqual([{ documentoId: 'v-409', monto: 50000 }, { documentoId: 'v-410', monto: 10000 }])
  })

  it('manual: lo imputado no puede superar el monto del cobro', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('20.000', 'Transferencia')
    await userEvent.press(screen.getByRole('radio', { name: 'Elegir comprobantes' }))
    await userEvent.press(await screen.findByRole('checkbox', { name: 'A00409, pendiente $ 50.000,00' }, ESPERA))
    await tocarRegistrar()

    expect(screen.getByText(IMPUTADO_DE_MAS)).toBeTruthy()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('el cobro registrado dice a qué comprobantes se imputó, según los movimientos del servidor', async () => {
    servidor({ imputadoA: [{ comprobante: 'A00409', monto: 50000 }, { comprobante: 'A00410', monto: 36400 }] })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await tocarRegistrar()

    expect(await screen.findByText('Imputado a A00409, A00410', {}, ESPERA)).toBeTruthy()
    expect(pidio('/api/v1/cuentas-corrientes/socios/c1/movimientos?pageNumber=1&pageSize=20&cuenta=Tst')).toBe(true)
  })

  it('con el servidor nuevo, "imputado a" sale de las imputaciones de GET /Pagos/{id}, sin cruzar movimientos', async () => {
    servidor({ pago: { id: 'p1', imputaciones: [
      { ventaId: 'v-409', codigoVenta: 'A00409', montoAmount: 50000 },
      { ventaId: 'v-410', codigoVenta: 'A00410', montoAmount: 36400 },
    ] } })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await tocarRegistrar()

    expect(await screen.findByText('Imputado a A00409, A00410', {}, ESPERA)).toBeTruthy()
    expect(pidio('/api/v1/Pagos/p1')).toBe(true)
    expect(pidio('/api/v1/cuentas-corrientes/socios/c1/movimientos')).toBe(false)
  })

  it('el 403 de GET /Pagos/{id} (quien cobra sin MOD_PAGOS:Read) es esperado: no se registra como error y cae a los movimientos', async () => {
    conPermisos([PAGOS, CC])
    servidor({ pago: new ApiError(403, 'No tenés permiso.'), imputadoA: [{ comprobante: 'A00409', monto: 86400 }] })
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('86.400', 'Transferencia')
    await tocarRegistrar()

    expect(await screen.findByText('Imputado a A00409', {}, ESPERA)).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/api/v1/Pagos/p1', { estadosEsperados: [403] })
  })
})
