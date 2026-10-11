import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { AVISO_CONDICION_PAGO } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, renderConQuery } from '../__testing__/ayuda'

const mockReplace = jest.fn()
let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

const post = api.post as jest.Mock
const put = api.put as jest.Mock
const SIN_CAP = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const CON_CAP = [...SIN_CAP, { module: 'CAP_AUTORIZAR_VENTA', canRead: true }]

async function completarAlta() {
  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Kiosco Chela')
  fireEvent.changeText(screen.getByLabelText('Contacto'), 'Chela')
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1146582291')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
})

it('sin la capacidad de autorizar ventas, la condición de pago es de solo lectura y no se manda', async () => {
  conPermisos(SIN_CAP)
  renderConQuery(<ClienteFormScreen />)

  expect(screen.getByText(AVISO_CONDICION_PAGO)).toBeTruthy()
  expect(screen.queryByRole('radio', { name: 'Días desde la entrega' })).toBeNull()
  await completarAlta()
  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  const body = post.mock.calls[0][1]
  expect(body).toMatchObject({ tipoRaw: 0, direccion: 'Av. del Valle 89', nombreFantasia: 'Kiosco Chela', nombreContacto: 'Chela' })
  expect(body.condicionPago).toBeUndefined()
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'nuevo-id' } })
})

it('con la capacidad, la condición de pago se elige y viaja al servidor', async () => {
  conPermisos(CON_CAP)
  renderConQuery(<ClienteFormScreen />)

  await completarAlta()
  await userEvent.press(screen.getByRole('radio', { name: 'Días desde la entrega' }))
  fireEvent.changeText(screen.getByLabelText('Días'), '15')
  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][1].condicionPago).toEqual({ tipo: 'DiasDesdeEntrega', dias: 15 })
})

it('si el servidor rechaza, se ve su mensaje con el detalle', async () => {
  conPermisos(SIN_CAP)
  post.mockRejectedValue(Object.assign(new Error('Datos inválidos.'), { errors: ['El teléfono es obligatorio en clientes.'] }))
  renderConQuery(<ClienteFormScreen />)

  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  expect(await screen.findByText('Datos inválidos.\nEl teléfono es obligatorio en clientes.')).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('al editar, carga los datos y devuelve el horario que no se edita acá', async () => {
  conPermisos(SIN_CAP)
  mockId = 'c1'
  const horario = [{ dia: 1, desde: '08:00', hasta: '12:00', esValida: true }]
  ;(api.get as jest.Mock).mockResolvedValue({ ...clienteDeLista(), horario, condicionesDeCompraFaltantes: [] })
  renderConQuery(<ClienteFormScreen />)

  await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
  await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(put).toHaveBeenCalled())
  expect(put.mock.calls[0][0]).toBe('/api/v1/socios-comerciales/c1')
  expect(put.mock.calls[0][1]).toMatchObject({ id: 'c1', nombreContacto: 'Chela', horario })
})
