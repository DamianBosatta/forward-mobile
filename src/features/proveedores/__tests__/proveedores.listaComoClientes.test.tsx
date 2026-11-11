import React from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { screen, userEvent, within } from '@testing-library/react-native'
import ProveedoresScreen from '../../../../app/(tabs)/proveedores/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))

/** S9: la lista de proveedores con el mismo estilo que la de Clientes (propuesta "Clientes como venta", frames 1 a 4). */
const get = api.get as jest.Mock
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>
const proveedor = (extra = {}) =>
  clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-70999888-5', tipo: 'Proveedor', direccion: '', nombreFantasia: null, nombreContacto: null, saldoAmount: 710430, ...extra })

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }, { module: 'MOD_COMPRAS', canRead: true, canCreate: true }])
  get.mockResolvedValue(pagina([proveedor()], 48))
})

it('cada fila lleva las iniciales de la razón social, como la de Clientes', async () => {
  renderConQuery(<ProveedoresScreen />)

  const fila = await screen.findByRole('button', { name: /^Insumos del Sur SA/ })
  expect(within(fila).getByText('ID')).toBeTruthy()
})

it('las filas van dentro de una tarjeta: la primera redondea arriba y la última abajo', async () => {
  get.mockResolvedValue(pagina([proveedor(), proveedor({ id: 'p2', razonSocial: 'Limpieza Norte SRL' })], 2))
  renderConQuery(<ProveedoresScreen />)

  const primera = await screen.findByRole('button', { name: /^Insumos del Sur SA/ })
  const ultima = screen.getByRole('button', { name: /^Limpieza Norte SRL/ })
  expect(estilo(primera)).toMatchObject({ marginHorizontal: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 })
  expect(estilo(primera).borderBottomLeftRadius ?? 0).toBe(0)
  expect(estilo(ultima)).toMatchObject({ borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderBottomWidth: 0 })
})

it('"Nueva compra" es el botón redondo de 44 con borde y no abre la ficha', async () => {
  renderConQuery(<ProveedoresScreen />)

  await screen.findByText('Insumos del Sur SA')
  const comprar = screen.getByLabelText('Nueva compra')
  expect(estilo(comprar)).toMatchObject({ width: 44, height: 44, borderRadius: 22, borderWidth: 1 })
  await userEvent.press(comprar)
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/nueva')
  expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/proveedores/[id]' }))
})

it('"Le debemos" y el importe van en el renglón de los chips, con "Faltan datos" al lado', async () => {
  get.mockResolvedValue(pagina([proveedor({ requiereCompletar: true })], 1))
  renderConQuery(<ProveedoresScreen />)

  const fila = await screen.findByRole('button', { name: /^Insumos del Sur SA/ })
  expect(within(fila).getByText('Faltan datos')).toBeTruthy()
  expect(within(fila).getByText('Le debemos')).toBeTruthy()
  expect(within(fila).getByText('$ 710.430,00')).toBeTruthy()
})

it('"N de M proveedores" va en una tarjeta', async () => {
  renderConQuery(<ProveedoresScreen />)

  const resumen = await screen.findByTestId('pie-proveedores')
  expect(within(resumen).getByText('1 de 48 proveedores')).toBeTruthy()
  expect(estilo(resumen)).toMatchObject({ marginHorizontal: 16, borderRadius: 16 })
})

it('el buscador es el grande de Clientes (52 de alto)', async () => {
  renderConQuery(<ProveedoresScreen />)
  await screen.findByText('Insumos del Sur SA')

  expect(estilo(screen.getByTestId('buscador-cartera'))).toMatchObject({ height: 52 })
})

it('mientras carga se ven esqueletos de fila, no la ruedita', async () => {
  get.mockImplementation(() => new Promise(() => {}))
  renderConQuery(<ProveedoresScreen />)

  expect((await screen.findAllByTestId('esqueleto-fila')).length).toBeGreaterThan(0)
  expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
})
