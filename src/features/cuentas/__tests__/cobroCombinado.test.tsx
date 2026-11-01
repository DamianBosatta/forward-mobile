import React from 'react'
import { Share } from 'react-native'
import { fireEvent, screen, userEvent } from '@testing-library/react-native'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { CHEQUE_SOLO_EN_UN_MEDIO, LINEA_INCOMPLETA } from '../lib/cobro'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') return [{ depositoId: 'dep-central', depositoNombre: 'Depósito Central' }]
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 84300, pagoId: 'p1' })])
    return fichaConCuentas()
  })
  post.mockResolvedValue({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', tipoCuenta: 'Tst' } })
})

/** Primer medio: el de siempre (grupo "Medio" y campo "Monto"). */
async function primerMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  // Cada línea repite los chips de los medios: el primero de la lista es el del primer medio.
  await userEvent.press((await screen.findAllByRole('radio', { name: medio }, ESPERA))[0])
}

/** "Otro medio": agrega una línea más al mismo cobro, con su medio y su monto. */
async function otroMedio(n: number, monto: string, medio: string | null) {
  await userEvent.press(screen.getByRole('button', { name: 'Otro medio' }))
  fireEvent.changeText(await screen.findByLabelText(`Monto del medio ${n}`), monto)
  if (medio) await userEvent.press(screen.getAllByRole('radio', { name: medio })[n - 1])
}

const registrar = () => userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

it('cobro combinado: manda una línea por medio en el mismo cobro, con el total de las dos', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await primerMedio('50.000', 'Efectivo')
  await otroMedio(2, '34.300', 'Transferencia')

  expect(screen.getByRole('button', { name: 'Registrar cobro de $ 84.300,00' })).toBeTruthy()
  await registrar()

  expect(post).toHaveBeenCalledTimes(1)
  const [url, cuerpo] = post.mock.calls[0]
  expect(url).toBe('/api/v1/Finanzas/pagos/multilinea')
  expect(cuerpo).toEqual({
    socioComercialId: 'c1',
    // Una de las líneas es efectivo: el servidor necesita saber en qué caja entra.
    depositoId: 'dep-central',
    claveIdempotencia: expect.stringMatching(/^mobile-/),
    lineas: [{ medioPagoId: 'm-ef', monto: 50000 }, { medioPagoId: 'm-tr', monto: 34300 }],
  })
  expect(await screen.findByText('Efectivo + Transferencia', {}, ESPERA)).toBeTruthy()
})

it('cobro combinado: el efectivo en la segunda línea también manda la caja', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await primerMedio('34.300', 'Transferencia')
  await otroMedio(2, '50.000', 'Efectivo')
  await registrar()

  expect(post.mock.calls[0][1]).toMatchObject({
    depositoId: 'dep-central',
    lineas: [{ medioPagoId: 'm-tr', monto: 34300 }, { medioPagoId: 'm-ef', monto: 50000 }],
  })
})

it('cobro combinado: el cheque no se combina (el servidor lo rechaza), se avisa y no se manda', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await primerMedio('50.000', 'Efectivo')
  await otroMedio(2, '34.300', 'Cheque')
  await registrar()

  expect(screen.getByText(CHEQUE_SOLO_EN_UN_MEDIO)).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('cobro combinado: una línea sin medio o sin monto no se manda; quitarla vuelve al cobro de un medio', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await primerMedio('50.000', 'Transferencia')
  await otroMedio(2, '1.000', null)
  await registrar()

  expect(screen.getByText(LINEA_INCOMPLETA)).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  await userEvent.press(screen.getByRole('button', { name: 'Quitar el medio 2' }))
  await registrar()

  expect(post.mock.calls[0][1].lineas).toEqual([{ medioPagoId: 'm-tr', monto: 50000 }])
})

describe('Mandar recibo', () => {
  async function cobroHecho() {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await primerMedio('50.000', 'Efectivo')
    await otroMedio(2, '34.300', 'Transferencia')
    await registrar()
    return screen.findByRole('button', { name: 'Mandar recibo' }, ESPERA)
  }

  it('abre el menú de compartir con el total, los medios y la aclaración de que no es fiscal', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
    await userEvent.press(await cobroHecho())

    expect(share).toHaveBeenCalledTimes(1)
    // formatImporte separa el símbolo con un espacio no cortante.
    const message = (share.mock.calls[0][0] as { message: string }).message.replace(/ /g, ' ')
    expect(message).toContain('$ 84.300,00')
    expect(message).toContain('Efectivo $ 50.000,00 + Transferencia $ 34.300,00')
    expect(message).toContain('Constancia de cobro, no es un comprobante fiscal.')
    share.mockRestore()
  })

  it('si compartir falla no se rompe: muestra un aviso en la pantalla', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('sin app'))
    await userEvent.press(await cobroHecho())

    expect(await screen.findByText('No se pudo abrir el menú de compartir. Probá de nuevo.', {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mandar recibo' })).toBeTruthy()
    share.mockRestore()
  })
})

it('con el cheque como medio inicial, abre el cobro con el medio Cheque elegido y su hoja lista', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} medioInicial="cheque" />)

  expect(await screen.findByLabelText('N.º de cheque', {}, ESPERA)).toBeTruthy()
  expect((await screen.findAllByRole('radio', { name: 'Cheque' }, ESPERA))[0].props.accessibilityState.selected).toBe(true)
})
