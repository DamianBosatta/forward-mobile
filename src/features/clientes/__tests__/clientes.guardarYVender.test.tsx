import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as Location from 'expo-location'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { AVISO_ALTA } from '../components/ClienteForm'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '../__testing__/ayuda'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}))

const post = api.post as jest.Mock
const PERMISOS = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]

beforeEach(() => {
  jest.clearAllMocks()
  post.mockResolvedValue('nuevo-id')
  conPermisos(PERMISOS)
})

describe('alta de cliente según el diseño (ModNuevoCliente)', () => {
  it('"Guardar y vender" crea el cliente con el mismo pedido y abre la venta nueva con ese cliente', async () => {
    renderConQuery(<ClienteFormScreen />)
    fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar y vender' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0][1]).toMatchObject({ tipoRaw: 0, direccion: 'Av. del Valle 89' })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/ventas/nueva', params: { clienteId: 'nuevo-id' } }))
  })

  it('"Guardar" sigue abriendo la ficha, no la venta', async () => {
    renderConQuery(<ClienteFormScreen />)
    fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'nuevo-id' } }))
  })

  it('muestra el aviso azul con el texto del diseño', () => {
    renderConQuery(<ClienteFormScreen />)
    expect(AVISO_ALTA).toBe('Queda en tu cartera. El tope de crédito y la condición de pago los define gestión.')
    expect(screen.getByText(AVISO_ALTA)).toBeTruthy()
  })

  it('"Usar mi ubicación" completa la dirección con la calle y el número del lugar donde está', async () => {
    ;(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
    ;(Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: -34.9, longitude: -57.9 } })
    ;(Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ street: 'Calle 7', streetNumber: '1245', name: 'x' }])
    renderConQuery(<ClienteFormScreen />)

    await userEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    await waitFor(() => expect(screen.getByLabelText('Dirección de entrega').props.value).toBe('Calle 7 1245'))
  })

  it('sin permiso de ubicación no toca la dirección y lo dice', async () => {
    ;(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    renderConQuery(<ClienteFormScreen />)
    fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Mi calle 1')

    await userEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByText('No pudimos usar tu ubicación. Escribí la dirección.')).toBeTruthy()
    expect(screen.getByLabelText('Dirección de entrega').props.value).toBe('Mi calle 1')
  })
})
