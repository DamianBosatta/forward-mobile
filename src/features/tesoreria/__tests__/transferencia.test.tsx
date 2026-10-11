import React from 'react'
import { fireEvent, screen, userEvent, within } from '@testing-library/react-native'
import { Transferencia } from '../components/Transferencia'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const cuenta = (id: string, nombre: string, saldoActual: number) => ({
  id, nombre, saldoActual, esPrincipal: false, activo: true, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false, puedeVerMovimientos: true,
})

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }, { id: 't-re', nombre: 'Retiro', activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [cuenta('caja', 'Caja de Emanuel', 412300), cuenta('gal', 'Banco Galicia', 2184950.4)]
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue('mi1')
})

const radio = (grupo: string, nombre: RegExp) => within(screen.getByLabelText(grupo)).getByRole('radio', { name: nombre })

it('registra el movimiento entre dos cuentas propias con el tipo del catálogo', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Banco Galicia/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')

  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(post).toHaveBeenCalledWith('/api/v1/movimientos-internos', {
    tipoMovimientoInternoId: 't-tr', cuentaOrigenId: 'caja', cuentaDestinoId: 'gal', monto: 350000, observaciones: null, retiradoPorNombre: null,
  })
  expect(await screen.findByText('Movimiento registrado')).toBeTruthy()
})

it('la cuenta de origen no se ofrece como destino', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
  await userEvent.press(radio('Desde', /^Banco Galicia/))

  expect(within(screen.getByLabelText('Hacia')).queryByRole('radio', { name: /^Banco Galicia/ })).toBeNull()
})

it('sin destino la plata sale: pide quién se la lleva y no manda cuenta de destino', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Retiro' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Ninguna/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '1000')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))
  expect(screen.getByText('Decí quién se lleva la plata.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  fireEvent.changeText(screen.getByLabelText('Quién se la lleva'), 'Emanuel')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(post.mock.calls[0][1]).toMatchObject({ cuentaDestinoId: null, retiradoPorNombre: 'Emanuel' })
})

it('si el servidor rechaza, se ve su motivo', async () => {
  post.mockRejectedValue(new Error('La moneda del movimiento (ARS) no coincide con la moneda de la cuenta de origen (USD).'))
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Banco Galicia/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '10')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(await screen.findByText(/no coincide con la moneda/)).toBeTruthy()
  expect(screen.queryByText('Movimiento registrado')).toBeNull()
})

it('en Tesorería, la transferencia solo se ofrece con permiso para crear pagos', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
  const { unmount } = renderConQuery(<TesoreriaScreen />)
  expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Transferencia entre cuentas' })).toBeNull()
  unmount()

  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  renderConQuery(<TesoreriaScreen />)
  await userEvent.press(await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA))
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/transferencia')
})

it('sin permiso para ver cuentas corrientes no se ofrece la transferencia: su pantalla lista las cuentas propias', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  renderConQuery(<TesoreriaScreen />)

  expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Transferencia entre cuentas' })).toBeNull()
})

it('sin permiso para leer pagos no se ofrece la transferencia: su pantalla pide los tipos de movimiento (MOD_PAGOS:Read)', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canCreate: true }, { module: 'MOD_CC', canRead: true }])
  renderConQuery(<TesoreriaScreen />)

  expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Transferencia entre cuentas' })).toBeNull()
})

it('la cartera de cheques y la caja de efectivo no se ofrecen ni de origen ni de destino', async () => {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) {
      return [
        cuenta('gal', 'Banco Galicia', 100),
        { ...cuenta('cart', 'Cartera de cheques', 5), esCuentaCarteraCheques: true },
        { ...cuenta('cef', 'Caja efectivo', 7), esCuentaCajaEfectivo: true },
      ]
    }
    throw new Error(`sin respuesta para ${url}`)
  })
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findAllByRole('radio', { name: /^Banco Galicia/ }, ESPERA)

  for (const grupo of ['Desde', 'Hacia']) {
    expect(within(screen.getByLabelText(grupo)).queryByRole('radio', { name: /^Cartera de cheques/ })).toBeNull()
    expect(within(screen.getByLabelText(grupo)).queryByRole('radio', { name: /^Caja efectivo/ })).toBeNull()
  }
})
