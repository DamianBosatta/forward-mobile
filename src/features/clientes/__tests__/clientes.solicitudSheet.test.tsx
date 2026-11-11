import React from 'react'
import { Linking } from 'react-native'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { FichaCliente } from '../components/FichaCliente'
import { SOLICITUD_ENVIADA } from '../components/SolicitudCambio'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

/** Propuesta "Clientes como venta", frames 8 y 9: "Pedir cambio de datos" es una hoja desde abajo sobre la ficha. */
const get = api.get as jest.Mock
const post = api.post as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canUpdate: true }])
  get.mockImplementation(async (url: string) => {
    if (url.includes('/estado-cuenta')) return { socioComercialId: 'c1', razonSocial: 'x', saldoActual: 0, saldoTst: 0, saldoNormal: 0, saldoAFavor: 0, movimientosPendientes: [] }
    if (url.startsWith('/api/v1/Ventas')) return pagina([], 0)
    return { ...clienteDeLista(), condicionesDeCompraFaltantes: [] }
  })
  post.mockResolvedValue('s1')
})

async function abrirHoja() {
  renderConQuery(<FichaCliente id="c1" />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
  await userEvent.press(screen.getByRole('button', { name: 'Pedir cambio' }))
  return screen.getByLabelText('Pedir cambio de datos')
}

it('"Pedir cambio" abre una hoja con los cuatro campos y los valores actuales', async () => {
  const hoja = await abrirHoja()

  expect(within(hoja).getByLabelText('Nueva dirección de entrega').props.value).toBe('Av. del Valle 89')
  expect(within(hoja).getByLabelText('Nueva razón social').props.value).toBe('Graciela Ruiz')
  expect(within(hoja).getByLabelText('Nuevo CUIT').props.value).toBe('27-24389156-3')
  expect(within(hoja).getByLabelText('Motivo')).toBeTruthy()
  expect(within(hoja).getByRole('button', { name: 'Enviar solicitud' })).toBeTruthy()
})

it('al enviar, la misma hoja muestra "Solicitud enviada" con el texto de hoy y "Listo" la cierra', async () => {
  const hoja = await abrirHoja()
  fireEvent.changeText(within(hoja).getByLabelText('Nuevo CUIT'), '27-24389156-4')
  await userEvent.press(within(hoja).getByRole('button', { name: 'Enviar solicitud' }))

  expect(await screen.findByRole('header', { name: 'Solicitud enviada' })).toBeTruthy()
  expect(screen.getByText(SOLICITUD_ENVIADA)).toBeTruthy()
  expect(screen.getByTestId('solicitud-enviada-marca')).toBeTruthy()
  expect(post).toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/solicitudes-cambio', { socioId: 'c1', cuit: '27-24389156-4', motivo: '' })

  await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(screen.queryByLabelText('Pedir cambio de datos')).toBeNull())
})

it('"Cancelar" cierra la hoja sin mandar nada', async () => {
  const hoja = await abrirHoja()
  await userEvent.press(within(hoja).getByRole('button', { name: 'Cancelar' }))

  await waitFor(() => expect(screen.queryByLabelText('Pedir cambio de datos')).toBeNull())
  expect(post).not.toHaveBeenCalled()
})
