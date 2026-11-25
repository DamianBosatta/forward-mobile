import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, within, screen, userEvent, waitFor } from '@testing-library/react-native'
import ProveedoresScreen from '../../../../app/(tabs)/proveedores/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isLarge: mockAncho() >= 600, isTablet: mockAncho() >= 600 }),
}))

const get = api.get as jest.Mock
const urlsDeLista = () => get.mock.calls.map(([url]) => String(url)).filter(u => u.startsWith('/api/v1/socios-comerciales?'))
const proveedor = (extra = {}) =>
  clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-70999888-5', tipo: 'Proveedor', direccion: '', nombreFantasia: null, nombreContacto: null, saldoAmount: 710430, ...extra })

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  get.mockResolvedValue(pagina([proveedor()], 48))
})

it('pide al servidor solo proveedores activos (tipo=2), sin agenda, y muestra "N de M"', async () => {
  renderConQuery(<ProveedoresScreen />)

  expect(await screen.findByText('Insumos del Sur SA')).toBeTruthy()
  expect(screen.getByText('1 de 48 proveedores')).toBeTruthy()
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

it('sin MOD_CC:read la fila no muestra el saldo aunque el servidor lo mande', async () => {
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true }])
  renderConQuery(<ProveedoresScreen />)

  await screen.findByText('Insumos del Sur SA')
  expect(screen.queryByText('Le debemos')).toBeNull()
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

  expect(await screen.findByText('Faltan datos de compra')).toBeTruthy()
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

  // MC-32: el panel vacío es la pantalla vacía común (título con ícono), no un texto suelto.
  expect(await screen.findByRole('header', { name: 'Elegí un proveedor para ver su ficha.' })).toBeTruthy()
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

describe.each(['light', 'dark'] as const)('revisión visual de proveedores (%s)', () => {
  it('MC-8: la lista deja libre el botón flotante al final (96 + inset)', async () => {
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    const lista = screen.UNSAFE_getByType(require('@shopify/flash-list').FlashList)
    expect(lista.props.contentContainerStyle.paddingBottom).toBeGreaterThanOrEqual(96)
  })

  it('en teléfono el menú lateral se abre con la hamburguesa', async () => {
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    expect(screen.getByLabelText('Abrir menú')).toBeTruthy()
  })

  it('en tablet el menú ya está fijo y la barra no repite la hamburguesa', async () => {
    mockAncho.mockReturnValue(1024)
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    expect(screen.queryByLabelText('Abrir menú')).toBeNull()
  })
})

describe('buscador sobre la columna de la lista (P17 A, MC-28)', () => {
  it('en tablet vertical el buscador usa la columna de 640, la misma de la lista', async () => {
    mockAncho.mockReturnValue(700)
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    const estilo = StyleSheet.flatten(screen.getByTestId('buscador-proveedores').props.style)
    expect(estilo.maxWidth).toBe(640)
    expect(estilo.alignSelf).toBe('center')
  })

  it('en tablet horizontal el buscador queda dentro de la columna de la lista', async () => {
    mockAncho.mockReturnValue(1000)
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    expect(within(screen.getByTestId('columna-lista-proveedores')).getByTestId('buscador-proveedores')).toBeTruthy()
  })

  it('en el teléfono el buscador no cambia: sin ancho máximo', async () => {
    renderConQuery(<ProveedoresScreen />)
    await screen.findByText('Insumos del Sur SA')
    expect(StyleSheet.flatten(screen.getByTestId('buscador-proveedores').props.style)?.maxWidth).toBeUndefined()
    expect(screen.queryByTestId('columna-lista-proveedores')).toBeNull()
  })
})
