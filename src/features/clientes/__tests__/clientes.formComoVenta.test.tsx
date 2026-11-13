import React from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { AVISO_CAMPOS_SENSIBLES } from '../components/ClienteForm'
import { api } from '@/core/api/client'
import { themeColors } from '@/libs/theme'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clienteDeLista, conPermisos, renderConQuery } from '../__testing__/ayuda'

let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

/** Propuesta "Clientes como venta", frames 15 a 20: un solo formulario con una tarjeta por grupo. */
const get = api.get as jest.Mock
const post = api.post as jest.Mock
const SIN_CAP = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>
const comoRol = (roles: string[]) => useAuthStore.setState({ user: { id: 'u1', username: 'x', email: 'x@x.com', roles, permissions: SIN_CAP } as never })

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  post.mockResolvedValue('nuevo-id')
  conPermisos(SIN_CAP)
})

it('cada grupo va en una tarjeta sin borde con su título', () => {
  renderConQuery(<ClienteFormScreen />)

  for (const grupo of ['Entrega', 'Datos fiscales', 'Contacto', 'Cómo paga']) {
    const tarjeta = screen.getByTestId(`grupo-${grupo}`)
    expect(estilo(tarjeta)).toMatchObject({ backgroundColor: themeColors.light.surface, borderRadius: 16 })
    expect(within(tarjeta).getByRole('header', { name: grupo })).toBeTruthy()
  }
})

it('"Alta provisoria" es un interruptor: prendido, el alta va como provisoria y la barra lo dice', async () => {
  renderConQuery(<ClienteFormScreen />)
  const interruptor = screen.getByRole('switch', { name: 'Alta provisoria' })
  expect(interruptor.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }))

  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  await userEvent.press(interruptor)
  expect(screen.getByRole('switch', { name: 'Alta provisoria' }).props.accessibilityState).toEqual(expect.objectContaining({ checked: true }))
  // El título del interruptor y el subtítulo de la barra.
  expect(screen.getAllByText('Alta provisoria')).toHaveLength(2)
  await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][1]).toMatchObject({ altaProvisoria: true })
})

it('la condición frente al IVA son filas con radio dentro de una tarjeta, como el paso Cliente de la venta', async () => {
  renderConQuery(<ClienteFormScreen />)

  const grupo = screen.getByLabelText('Condición frente al IVA')
  await userEvent.press(within(grupo).getByRole('radio', { name: 'Monotributista' }))
  const elegido = within(grupo).getByRole('radio', { name: 'Monotributista' })
  expect(elegido.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }))
  expect(estilo(elegido).backgroundColor).toBe(themeColors.light.brandSoft)
  expect(within(elegido).getByTestId('marca-radio-elegida')).toBeTruthy()
})

describe('editar como vendedor (frame 19)', () => {
  beforeEach(() => {
    mockId = 'c1'
    get.mockResolvedValue({ ...clienteDeLista(), horario: [], condicionesDeCompraFaltantes: [] })
  })

  it('lo que no puede cambiar pasa a filas bloqueadas en una tarjeta propia, con el aviso de dónde pedir el cambio', async () => {
    comoRol(['Empleado'])
    renderConQuery(<ClienteFormScreen />)

    const tarjeta = await screen.findByTestId('campos-bloqueados')
    expect(within(tarjeta).getByText(AVISO_CAMPOS_SENSIBLES)).toBeTruthy()
    expect(within(tarjeta).getByLabelText('Dirección de entrega: Av. del Valle 89')).toBeTruthy()
    expect(within(tarjeta).getByLabelText('CUIT: 27-24389156-3')).toBeTruthy()
    expect(within(tarjeta).getByLabelText('Razón social: Graciela Ruiz')).toBeTruthy()
    // Ya no son campos atenuados: no hay caja para tipear.
    expect(screen.queryByLabelText('Dirección de entrega')).toBeNull()
    expect(screen.queryByLabelText('CUIT')).toBeNull()
    expect(screen.queryByLabelText('Razón social')).toBeNull()
    expect(screen.getByLabelText('Nombre del local').props.editable).not.toBe(false)
  })

  it('mientras carga se ven esqueletos con la forma de las tarjetas, no la ruedita', async () => {
    get.mockImplementation(() => new Promise(() => {}))
    renderConQuery(<ClienteFormScreen />)

    expect(await screen.findByTestId('esqueleto-tarjeta')).toBeTruthy()
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
    expect(screen.queryByLabelText('Nombre del local')).toBeNull()
  })
})
