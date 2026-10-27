import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ProveedoresScreen from '../../../../app/(tabs)/proveedores/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isLarge: mockAncho() >= 600 }),
}))

const get = api.get as jest.Mock
const urlsDeLista = () => get.mock.calls.map(([url]) => String(url)).filter(u => u.startsWith('/api/v1/socios-comerciales?'))
const proveedor = (extra = {}) =>
  clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-70999888-5', tipo: 'Proveedor', direccion: '', nombreFantasia: null, nombreContacto: null, saldoAmount: 710430, ...extra })

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true }])
  get.mockResolvedValue(pagina([proveedor()], 48))
})

it('pide al servidor solo proveedores activos (tipo=2), sin agenda, y muestra "N de M"', async () => {
  renderConQuery(<ProveedoresScreen />)

  expect(await screen.findByText('Insumos del Sur SA')).toBeTruthy()
  expect(screen.getByText('1 de 48')).toBeTruthy()
  const url = urlsDeLista()[0]
  expect(url).toContain('tipo=2')
  expect(url).toContain('activo=true')
  expect(url).not.toContain('agenda')
})

it('la tarjeta dice el CUIT y cuánto se le debe, si el servidor deja ver el saldo', async () => {
  renderConQuery(<ProveedoresScreen />)

  expect(await screen.findByText('CUIT 30-70999888-5')).toBeTruthy()
  expect(screen.getByText('Le debemos')).toBeTruthy()
  expect(screen.getByText(/710\.430/)).toBeTruthy()
})

it('si el servidor no deja ver el saldo, no se muestra', async () => {
  get.mockResolvedValue(pagina([proveedor({ puedeVerSaldo: false })], 1))
  renderConQuery(<ProveedoresScreen />)

  await screen.findByText('Insumos del Sur SA')
  expect(screen.queryByText('Le debemos')).toBeNull()
})

it('un proveedor que el servidor marca para completar muestra "Faltan datos"', async () => {
  get.mockResolvedValue(pagina([proveedor({ requiereCompletar: true })], 1))
  renderConQuery(<ProveedoresScreen />)

  expect(await screen.findByText('Faltan datos')).toBeTruthy()
})

it('la búsqueda va al servidor una sola vez, después de dejar de tipear', async () => {
  renderConQuery(<ProveedoresScreen />)
  await screen.findByText('Insumos del Sur SA')
  const campo = screen.getByLabelText('Buscar proveedor')

  fireEvent.changeText(campo, 'I')
  fireEvent.changeText(campo, 'Insumos')
  expect(urlsDeLista().some(u => u.includes('searchTerm'))).toBe(false)

  await waitFor(() => expect(urlsDeLista().some(u => u.includes('searchTerm=Insumos'))).toBe(true))
  expect(urlsDeLista().filter(u => u.includes('searchTerm'))).toHaveLength(1)
})

it('Nuevo proveedor lo ofrece MOD_PROVEEDORES:create', async () => {
  renderConQuery(<ProveedoresScreen />)
  await userEvent.press(await screen.findByRole('button', { name: 'Nuevo proveedor' }))
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/proveedores/nuevo')
})

it('con solo MOD_CLIENTES:create no hay Nuevo proveedor', async () => {
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true }, { module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
  renderConQuery(<ProveedoresScreen />)

  await screen.findByText('Insumos del Sur SA')
  expect(screen.queryByRole('button', { name: 'Nuevo proveedor' })).toBeNull()
})

it('en el teléfono, tocar una tarjeta abre la ficha en su pantalla', async () => {
  renderConQuery(<ProveedoresScreen />)
  await userEvent.press(await screen.findByRole('button', { name: /Insumos del Sur SA/ }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/proveedores/[id]', params: { id: 'p1' } })
})

it('en tablet, lista y ficha van lado a lado: tocar una tarjeta abre la ficha en el panel', async () => {
  mockAncho.mockReturnValue(1024)
  get.mockImplementation(async (url: string) =>
    url.startsWith('/api/v1/socios-comerciales?')
      ? pagina([proveedor()], 1)
      : url.startsWith('/api/v1/Compras')
        ? pagina([], 0)
        : { ...proveedor(), condicionesDeCompraFaltantes: [], condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 } },
  )
  renderConQuery(<ProveedoresScreen />)

  expect(await screen.findByText('Elegí un proveedor para ver su ficha.')).toBeTruthy()
  await userEvent.press(await screen.findByRole('button', { name: /Insumos del Sur SA/ }))

  expect(await screen.findByRole('header', { name: 'Insumos del Sur SA' })).toBeTruthy()
  expect(mockPush).not.toHaveBeenCalled()
})

it('sin resultados lo dice', async () => {
  get.mockResolvedValue(pagina([], 0))
  renderConQuery(<ProveedoresScreen />)
  expect(await screen.findByText('Todavía no hay proveedores cargados.')).toBeTruthy()
})

describe('Nueva compra en la tarjeta (ModProveedores)', () => {
  it('con MOD_COMPRAS:create la tarjeta trae "Nueva compra" y abre la compra nueva sin abrir la ficha', async () => {
    conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true }, { module: 'MOD_COMPRAS', canRead: true, canCreate: true }])
    renderConQuery(<ProveedoresScreen />)

    await userEvent.press(await screen.findByLabelText('Nueva compra'))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/nueva')
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/proveedores/[id]' }))
  })

  it('sin MOD_COMPRAS:create la tarjeta no la ofrece', async () => {
    renderConQuery(<ProveedoresScreen />)

    await screen.findByText('Insumos del Sur SA')
    expect(screen.queryByLabelText('Nueva compra')).toBeNull()
  })
})
