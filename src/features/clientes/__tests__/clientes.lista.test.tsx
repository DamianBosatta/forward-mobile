import React from 'react'
import { FlatList, Linking } from 'react-native'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
  get.mockResolvedValue(pagina([clienteDeLista()], 142))
})

it('la dirección es el título y el nombre va en una línea aparte, nunca pegados', async () => {
  renderConQuery(<ClientesScreen />)

  expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
  expect(screen.getByText('Chela · Kiosco Chela')).toBeTruthy()
  expect(screen.queryByText(/Av\. del Valle 89.*Kiosco/)).toBeNull()
})

it('pide la cartera al servidor (solo clientes, activos, agenda) y muestra "Mostrando N de M" con su total', async () => {
  renderConQuery(<ClientesScreen />)

  expect(await screen.findByText('Mostrando 1 de 142')).toBeTruthy()
  const url = urlsDeLista()[0]
  expect(url).toContain('tipo=1')
  expect(url).toContain('activo=true')
  expect(url).toContain('agenda=true')
})

it('la búsqueda va al servidor una sola vez, después de dejar de tipear', async () => {
  renderConQuery(<ClientesScreen />)
  await screen.findByText('Av. del Valle 89')
  const campo = screen.getByLabelText('Buscar cliente')

  fireEvent.changeText(campo, 'V')
  fireEvent.changeText(campo, 'Va')
  fireEvent.changeText(campo, 'Valle')
  expect(urlsDeLista().some(u => u.includes('searchTerm'))).toBe(false)

  await waitFor(() => expect(urlsDeLista().some(u => u.includes('searchTerm=Valle'))).toBe(true))
  expect(urlsDeLista().filter(u => u.includes('searchTerm'))).toHaveLength(1)
})

it('sin permiso del servidor para ver el saldo, la tarjeta no lo muestra', async () => {
  get.mockResolvedValue(pagina([clienteDeLista({ puedeVerSaldo: false, saldoAmount: 0 })], 1))
  renderConQuery(<ClientesScreen />)

  await screen.findByText('Av. del Valle 89')
  expect(screen.queryByText('Saldo')).toBeNull()
})

it('si el servidor rechaza, se ve su mensaje', async () => {
  get.mockRejectedValue(new Error('No tenés permisos para esta acción.'))
  renderConQuery(<ClientesScreen />)

  expect(await screen.findByText('No tenés permisos para esta acción.')).toBeTruthy()
})

it('en teléfono, tocar el cliente abre su ficha', async () => {
  renderConQuery(<ClientesScreen />)
  await userEvent.press(await screen.findByRole('button', { name: /Av\. del Valle 89/ }))

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })
})

it('en tablet ancha, la ficha se abre al lado de la lista', async () => {
  mockAncho.mockReturnValue(1024)
  get.mockImplementation(async (url: string) =>
    url.startsWith('/api/v1/socios-comerciales?') ? pagina([clienteDeLista()], 1)
      : url.startsWith('/api/v1/Ventas') ? pagina([], 0)
      : { ...clienteDeLista(), puedeVerCuentaCorriente: false, condicionIva: 'Monotributo' },
  )
  renderConQuery(<ClientesScreen />)
  await userEvent.press(await screen.findByRole('button', { name: /Av\. del Valle 89/ }))

  expect(mockPush).not.toHaveBeenCalled()
  expect(await screen.findByRole('radio', { name: 'Datos' })).toBeTruthy()
})

it('sin permiso de alta no hay botón de nuevo cliente', async () => {
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: false }])
  renderConQuery(<ClientesScreen />)

  await screen.findByText('Av. del Valle 89')
  expect(screen.queryByLabelText('Nuevo cliente')).toBeNull()
})

describe('deuda vencida y saldo de la cartera (servidor con PR #882)', () => {
  it('la tarjeta del cliente con deuda vencida lleva el chip; la del que no tiene, no', async () => {
    get.mockResolvedValue(pagina([
      clienteDeLista({ tieneDeudaVencida: true, deudaVencidaAmount: 86400 }),
      clienteDeLista({ id: 'c2', direccion: 'Brandsen 3314', tieneDeudaVencida: false, deudaVencidaAmount: 0 }),
    ], 2))
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByRole('button', { name: /Av\. del Valle 89.*deuda vencida/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Brandsen 3314/ }).props.accessibilityLabel).not.toMatch(/deuda vencida/)
    expect(screen.getAllByText('Deuda vencida')).toHaveLength(1)
  })

  it('con el saldo total del servidor, el contador lo muestra; nunca lo suma el teléfono', async () => {
    get.mockResolvedValue({ ...pagina([clienteDeLista()], 142), saldoTotal: 4812330 })
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Mostrando 1 de 142 · Saldo $ 4.812.330')).toBeTruthy()
  })

  it('el saldo total llega solo en la página 1: al cargar más se mantiene', async () => {
    get.mockImplementation(async (url: string) =>
      url.includes('pageNumber=2')
        ? { ...pagina([clienteDeLista({ id: 'c2', direccion: 'Brandsen 3314' })], 142), page: 2, saldoTotal: null }
        : { ...pagina([clienteDeLista()], 142), hasNextPage: true, saldoTotal: 4812330 },
    )
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Mostrando 1 de 142 · Saldo $ 4.812.330')

    fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached')

    expect(await screen.findByText('Mostrando 2 de 142 · Saldo $ 4.812.330')).toBeTruthy()
  })

  it('si el servidor no da el saldo total (null) o es un servidor anterior, queda "Mostrando N de M" y sin chips', async () => {
    get.mockResolvedValue({ ...pagina([clienteDeLista()], 142), saldoTotal: null })
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Mostrando 1 de 142')).toBeTruthy()
    expect(screen.queryByText(/Saldo \$ /)).toBeNull()
    expect(screen.queryByText('Deuda vencida')).toBeNull()
  })
})

describe('localidad y filtros (9C)', () => {
  it('la tarjeta muestra la localidad en una línea aparte', async () => {
    get.mockResolvedValue(pagina([clienteDeLista({ localidad: 'Ramos Mejía' })], 1))
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Ramos Mejía')).toBeTruthy()
  })

  it('"Con deuda vencida" le pide el filtro al servidor, y tocarlo de nuevo lo saca', async () => {
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')

    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))
    await waitFor(() => expect(urlsDeLista().some(u => u.includes('conDeudaVencida=true'))).toBe(true))
    expect(screen.getByRole('button', { name: 'Con deuda vencida', selected: true })).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))
    expect(screen.getByRole('button', { name: 'Con deuda vencida', selected: false })).toBeTruthy()
  })

  it('las localidades salen del servidor y elegir una filtra por ella', async () => {
    get.mockImplementation(async (url: string) =>
      url === '/api/v1/socios-comerciales/localidades' ? ['Castelar', 'Haedo'] : pagina([clienteDeLista()], 1),
    )
    renderConQuery(<ClientesScreen />)

    await userEvent.press(await screen.findByRole('button', { name: 'Haedo' }))

    await waitFor(() => expect(urlsDeLista().some(u => u.includes('localidad=Haedo'))).toBe(true))
  })

  it('con filtros y sin resultados, lo dice', async () => {
    get.mockResolvedValue(pagina([], 0))
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Todavía no hay clientes en tu cartera.')

    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))

    expect(await screen.findByText('Ningún cliente coincide con los filtros.')).toBeTruthy()
  })
})

it('con un servidor sin el endpoint de localidades (responde 400 por la ruta {id}, o 404) no lo registra como error', async () => {
  renderConQuery(<ClientesScreen />)
  await screen.findByText('Av. del Valle 89')

  const llamada = get.mock.calls.find(([url]) => url === '/api/v1/socios-comerciales/localidades')
  expect(llamada?.[1]).toEqual(expect.objectContaining({ estadosEsperados: expect.arrayContaining([400, 404]) }))
})

describe('lámina Clientes (bloque 12, T7)', () => {
  it('con permiso de alta, el botón fijo "Nuevo cliente" abre el alta', async () => {
    renderConQuery(<ClientesScreen />)

    await userEvent.press(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/socios/nuevo')
  })

  it('la pastilla "Mi cartera" dice cuántos son; con una búsqueda o un filtro ya no (el total sería otro)', async () => {
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByRole('button', { name: 'Mi cartera · 142' })).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Mi cartera/ })).toBeNull())
  })

  it('cada tarjeta con teléfono tiene Llamar, que marca sin abrir la ficha', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    renderConQuery(<ClientesScreen />)

    await screen.findByText('Av. del Valle 89')
    await userEvent.press(screen.getByLabelText('Llamar'))
    expect(abrir).toHaveBeenCalledWith('tel:1146582291')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sin teléfono no hay Llamar', async () => {
    get.mockResolvedValue(pagina([clienteDeLista({ telefono: '' })], 1))
    renderConQuery(<ClientesScreen />)

    await screen.findByText('Av. del Valle 89')
    expect(screen.queryByRole('button', { name: 'Llamar' })).toBeNull()
  })

  it('el cliente con deuda vencida muestra cuánto, solo si el servidor deja ver el saldo', async () => {
    get.mockResolvedValue(pagina([
      clienteDeLista({ tieneDeudaVencida: true, deudaVencidaAmount: 84300 }),
      clienteDeLista({ id: 'c2', direccion: 'Brandsen 3314', tieneDeudaVencida: true, deudaVencidaAmount: 500, puedeVerSaldo: false }),
    ], 2))
    renderConQuery(<ClientesScreen />)

    expect(await screen.findByText('Vencido $ 84.300,00')).toBeTruthy()
    expect(screen.queryByText(/Vencido \$ 500/)).toBeNull()
  })
})

it('en el teléfono la barra de abajo sigue a la vista en Clientes (lámina CalleMiDia)', async () => {
  renderConQuery(<ClientesScreen />)

  expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
  expect(screen.getByText('Mi día')).toBeTruthy()
})
