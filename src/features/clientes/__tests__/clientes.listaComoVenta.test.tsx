import React from 'react'
import { ActivityIndicator, Linking, StyleSheet } from 'react-native'
import { screen, userEvent, within } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import { ClienteCard } from '../components/ClienteCard'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))

/** Propuesta "Clientes como venta", frames 1 a 4: la lista de clientes con la visual de "Elegir cliente" de la venta. */
const get = api.get as jest.Mock
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
  get.mockResolvedValue(pagina([clienteDeLista()], 142))
})

it('cada fila lleva las iniciales de la dirección en lugar del radio de la venta', async () => {
  renderConQuery(<ClientesScreen />)

  const fila = await screen.findByRole('button', { name: /Av\. del Valle 89/ })
  expect(within(fila).getByText('DV')).toBeTruthy()
})

it('cada fila es una tarjeta propia de radio 22', async () => {
  get.mockResolvedValue(pagina([clienteDeLista({ id: 'a', direccion: 'Av. del Valle 89' }), clienteDeLista({ id: 'b', direccion: 'Alsina 20' })], 2))
  renderConQuery(<ClientesScreen />)

  // El orden lo da el servidor (OrdenarPor=Direccion): la lista no reordena.
  const primera = await screen.findByRole('button', { name: /^Av\. del Valle 89/ })
  const ultima = screen.getByRole('button', { name: /^Alsina 20/ })
  expect(estilo(primera)).toMatchObject({ marginHorizontal: 16, borderRadius: 22, marginBottom: 8 })
  expect(estilo(ultima)).toMatchObject({ borderRadius: 22, marginBottom: 0 })
})

it('cartera de otro vendedor: el candado dice "Saldo reservado" con texto, no solo para el lector de pantalla', async () => {
  get.mockResolvedValue(pagina([clienteDeLista({ puedeVerSaldo: false, saldoAmount: 0, vendedorResponsableNombre: 'Lucía R.' })], 1))
  renderConQuery(<ClientesScreen />)

  const fila = await screen.findByRole('button', { name: /Av\. del Valle 89/ })
  expect(within(fila).getByText('Saldo reservado')).toBeTruthy()
  expect(within(fila).getByText('Cartera de otro vendedor')).toBeTruthy()
  expect(within(fila).getByText('Vendedor: Lucía R.')).toBeTruthy()
})

it('Llamar es un botón redondo de 44 sin borde, que marca sin abrir la ficha', async () => {
  renderConQuery(<ClientesScreen />)

  await screen.findByText('Av. del Valle 89')
  const llamar = screen.getByLabelText('Llamar')
  expect(estilo(llamar)).toMatchObject({ width: 44, height: 44, borderRadius: 22 })
  await userEvent.press(llamar)
  expect(Linking.openURL).toHaveBeenCalledWith('tel:1146582291')
  expect(mockPush).not.toHaveBeenCalled()
})

it('"N de M clientes" y "Saldo total" van en una tarjeta, con el saldo en cifra mediana', async () => {
  get.mockResolvedValue({ ...pagina([clienteDeLista()], 142), saldoTotal: 1015230 })
  renderConQuery(<ClientesScreen />)

  const resumen = await screen.findByTestId('pie-clientes')
  expect(within(resumen).getByText('1 de 142 clientes')).toBeTruthy()
  expect(within(resumen).getByText('Saldo total')).toBeTruthy()
  expect(estilo(within(resumen).getByText('$ 1.015.230,00'))).toMatchObject({ fontSize: 24, lineHeight: 32 })
})

it('el buscador es el grande de la venta (52 de alto)', async () => {
  renderConQuery(<ClientesScreen />)
  await screen.findByText('Av. del Valle 89')

  expect(estilo(screen.getByTestId('buscador-cartera'))).toMatchObject({ height: 52 })
})

it('mientras carga se ven esqueletos de fila, no la ruedita', async () => {
  get.mockImplementation(() => new Promise(() => {}))
  renderConQuery(<ClientesScreen />)

  expect((await screen.findAllByTestId('esqueleto-fila')).length).toBeGreaterThan(0)
  expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
})

it('sin variante, ClienteCard sigue siendo la fila plana de siempre (lista "Me deben" y cobros)', () => {
  renderConQuery(<ClienteCard cliente={clienteDeLista()} onPress={jest.fn()} />)

  expect(screen.queryByText('DV')).toBeNull()
  expect(estilo(screen.getByRole('button', { name: /Av\. del Valle 89/ })).borderRadius).toBeUndefined()
})
