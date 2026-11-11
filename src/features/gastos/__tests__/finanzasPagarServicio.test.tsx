import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { PagarServicio } from '../components/PagarServicio'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

/** Propuesta "Finanzas como venta", frames 14 y 15 (Pagar un servicio). */

jest.mock('@/core/ui/Toast', () => ({ useToast: () => ({ show: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const liviana = (id: string, nombre: string) => ({ id, nombre, moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false })

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }, { module: 'CAP_VER_TESORERIA', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/tipos-gasto') return [{ id: 'tg-luz', nombre: 'Luz', activo: true }]
    if (url === '/api/v1/gastos/medios-pago') return [{ id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [liviana('gal', 'Banco Galicia')]
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue({ succeeded: true, data: 'g1' })
})

it('monto grande y tres tarjetas: concepto y descripción; medio y cuenta con radio; comprobante (frame 14)', async () => {
  renderConQuery(<PagarServicio onListo={jest.fn()} />)

  expect(StyleSheet.flatten((await screen.findByTestId('monto-grande', {}, ESPERA)).props.style).height).toBe(64)
  const concepto = screen.getByTestId('tarjeta-concepto')
  expect(await within(concepto).findByRole('radio', { name: 'Luz' }, ESPERA)).toBeTruthy()
  expect(within(concepto).getByLabelText('Descripción (opcional)')).toBeTruthy()

  const medio = screen.getByTestId('tarjeta-medio')
  await userEvent.press(await within(medio).findByRole('radio', { name: 'Transferencia' }, ESPERA))
  const cuenta = await within(screen.getByTestId('tarjeta-medio')).findByRole('radio', { name: /^Banco Galicia/ }, ESPERA)
  expect(within(cuenta).getByTestId('marca-radio')).toBeTruthy()

  expect(within(screen.getByTestId('tarjeta-comprobante')).getAllByRole('button').length).toBeGreaterThan(0)
})

it('el aviso de qué falta queda arriba del pie (frame 15)', async () => {
  renderConQuery(<PagarServicio onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Luz' }, ESPERA)

  await userEvent.press(screen.getByRole('button', { name: 'Registrar pago' }))

  expect(within(screen.getByTestId('pie-avisos')).getByText('Ingresá el monto.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('el cuerpo del pago no cambia: descripción recortada, medio y cuenta de origen', async () => {
  renderConQuery(<PagarServicio onListo={jest.fn()} />)
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '48.300')
  await userEvent.press(await screen.findByRole('radio', { name: 'Luz' }, ESPERA))
  fireEvent.changeText(screen.getByLabelText('Descripción (opcional)'), '  Factura de octubre ')
  await userEvent.press(screen.getByRole('radio', { name: 'Transferencia' }))
  await userEvent.press(await screen.findByRole('radio', { name: /^Banco Galicia/ }, ESPERA))
  await userEvent.press(screen.getByRole('button', { name: 'Registrar pago' }))

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
  expect(post.mock.calls[0]).toEqual(['/api/v1/gastos', {
    descripcion: 'Factura de octubre', monto: 48300, tipoGastoId: 'tg-luz', medioPagoId: 'm-tr', cuentaOrigenId: 'gal', comprobanteUrl: null,
  }])
})
