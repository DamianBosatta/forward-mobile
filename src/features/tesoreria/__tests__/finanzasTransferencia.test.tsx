import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, screen, userEvent, within } from '@testing-library/react-native'
import { Transferencia } from '../components/Transferencia'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

/** Propuesta "Finanzas como venta", frames 10 a 13 (Transferencia). */

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const liviana = (id: string, nombre: string) => ({ id, nombre, moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false })

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }, { id: 't-re', nombre: 'Retiro', activo: true }]
    if (url === '/api/v1/cuentas-corrientes/propias/para-cobrar') return [liviana('caja', 'Caja de Emanuel'), liviana('gal', 'Banco Galicia')]
    const restante = url.match(/saldo-restante\?monto=(.+)$/)
    if (restante) return { cuentaId: 'caja', moneda: 'ARS', saldoActual: 412300, monto: Number(restante[1]), saldoRestante: 412300 - Number(restante[1]) }
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue('mi1')
})

const radio = (grupo: string, nombre: RegExp) => within(screen.getByLabelText(grupo)).getByRole('radio', { name: nombre })

it('el monto es una cifra grande con "$", en un campo de 64 px (frame 10)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  const caja = await screen.findByTestId('monto-grande', {}, ESPERA)

  expect(StyleSheet.flatten(caja.props.style).height).toBe(64)
  expect(within(caja).getByText('$')).toBeTruthy()
  expect(within(caja).getByLabelText('Monto')).toBeTruthy()
})

it('el tipo va en una tarjeta con su título y la elegida lleva tilde (frame 10)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  const tarjeta = await screen.findByTestId('tarjeta-tipo', {}, ESPERA)
  expect(within(tarjeta).getByText('Tipo')).toBeTruthy()

  await userEvent.press(await within(tarjeta).findByRole('radio', { name: 'Transferencia' }, ESPERA))

  expect(within(screen.getByTestId('tarjeta-tipo')).getByTestId('chip-tilde')).toBeTruthy()
})

it('cada cuenta es una fila con radio; la elegida lleva la marca (frame 10)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
  expect(within(radio('Desde', /^Caja de Emanuel/)).getByTestId('marca-radio')).toBeTruthy()

  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(within(screen.getByLabelText('Desde')).getByRole('button', { name: /Cambiar Desde/ }))

  expect(within(radio('Desde', /^Caja de Emanuel/)).getByTestId('marca-radio-elegida')).toBeTruthy()
  expect(radio('Desde', /^Caja de Emanuel/).props.accessibilityState.checked).toBe(true)
})

it('"Desde" elegida se pliega a una fila con "Cambiar" y, con retiro, "Quién se la lleva" va en la misma tarjeta (frame 11)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Retiro' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))

  expect(within(screen.getByLabelText('Desde')).getByText('Cambiar')).toBeTruthy()
  await userEvent.press(radio('Hacia', /^Ninguna/))
  expect(within(screen.getByTestId('tarjeta-cuentas')).getByLabelText('Quién se la lleva')).toBeTruthy()
})

it('lo que queda en la cuenta de origen va justo debajo del monto (frame 11)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '150.000')

  expect(await within(screen.getByTestId('bloque-monto')).findByText('Te quedan $ 262.300,00 en Caja de Emanuel.', {}, ESPERA)).toBeTruthy()
})

it('el aviso de qué falta y el error al guardar quedan arriba del pie, a la vista del botón (frame 12)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)

  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(within(screen.getByTestId('pie-avisos')).getByText('Elegí el tipo de movimiento.')).toBeTruthy()
})

it('registrado: dibujo de "listo", título, explicación y "Volver" en el pie (frame 13)', async () => {
  const onListo = jest.fn()
  renderConQuery(<Transferencia onListo={onListo} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Banco Galicia/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(await screen.findByTestId('listo-icono', { includeHiddenElements: true }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Movimiento registrado')).toBeTruthy()
  expect(screen.getByText('Los saldos de las cuentas ya están actualizados.')).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
  expect(onListo).toHaveBeenCalled()
})

it('el cuerpo de un retiro no cambia: sin destino, con quién se la lleva y "Op." delante de la nota', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Retiro' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Ninguna/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '1.500,50')
  fireEvent.changeText(screen.getByLabelText('Quién se la lleva'), ' Emanuel ')
  fireEvent.changeText(screen.getByLabelText('N.º de operación (opcional)'), '77')
  fireEvent.changeText(screen.getByLabelText('Observaciones (opcional)'), 'Viáticos')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0]).toEqual(['/api/v1/movimientos-internos', {
    tipoMovimientoInternoId: 't-re', cuentaOrigenId: 'caja', cuentaDestinoId: null, monto: 1500.5, observaciones: 'Op. 77 · Viáticos', retiradoPorNombre: 'Emanuel',
  }])
})
