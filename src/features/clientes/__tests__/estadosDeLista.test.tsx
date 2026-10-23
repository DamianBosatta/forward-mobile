/**
 * Bloque 12, T13c (lienzo R16): las listas de Clientes, Proveedores y Cuentas corrientes muestran
 * "vacío" y "sin conexión" con el mismo componente de pantalla. Las frases de hoy no cambian.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import ProveedoresScreen from '../../../../app/(tabs)/proveedores/index'
import CuentasScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina } from '../__testing__/ayuda'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: 390, isLarge: false, isTablet: false, isTabletLandscape: false }),
}))

const get = api.get as jest.Mock
const SIN_RED = () => new TypeError('Network request failed')
jest.setTimeout(15_000)

function pintar(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
  return qc
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([
    { module: 'MOD_CLIENTES', canRead: true, canCreate: true },
    { module: 'MOD_PROVEEDORES', canRead: true, canCreate: true },
    { module: 'MOD_CC', canRead: true },
  ])
  get.mockResolvedValue(pagina([], 0))
})

describe.each([
  { nombre: 'Clientes', Pantalla: ClientesScreen, buscador: 'Buscar cliente', vacio: 'Todavía no hay clientes en tu cartera.', sinBusqueda: 'Ningún cliente coincide con la búsqueda.', falla: 'No pudimos cargar los clientes', fila: 'Av. del Valle 89' },
  { nombre: 'Proveedores', Pantalla: ProveedoresScreen, buscador: 'Buscar proveedor', vacio: 'Todavía no hay proveedores cargados.', sinBusqueda: 'Ningún proveedor coincide con la búsqueda.', falla: 'No pudimos cargar los proveedores', fila: 'Insumos del Sur SA', item: { razonSocial: 'Insumos del Sur SA', direccion: '' } },
  { nombre: 'Cuentas corrientes', Pantalla: CuentasScreen, buscador: 'Buscar cliente', vacio: 'Todavía no hay clientes en tu cartera.', sinBusqueda: 'Ningún cliente coincide con la búsqueda.', falla: 'No pudimos cargar los clientes', fila: 'Av. del Valle 89' },
])('$nombre', ({ Pantalla, buscador, vacio, sinBusqueda, falla, fila, item }) => {
  it('lista vacía sin búsqueda: estado "vacío" con la frase de siempre', async () => {
    pintar(<Pantalla />)

    expect(await screen.findByRole('header', { name: vacio })).toBeTruthy()
  })

  it('vacía por la búsqueda: la frase de la búsqueda, sin acción', async () => {
    pintar(<Pantalla />)
    await screen.findByRole('header', { name: vacio })

    fireEvent.changeText(screen.getByLabelText(buscador), 'zzz')

    expect(await screen.findByRole('header', { name: sinBusqueda })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    get.mockRejectedValue(SIN_RED())
    pintar(<Pantalla />)

    expect(await screen.findByRole('header', { name: falla })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    get.mockResolvedValue(pagina([clienteDeLista(item)], 1))
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(fila)).toBeTruthy()
  })

  it('con lo guardado y sin conexión: la lista sigue y un aviso dice a qué hora se guardó', async () => {
    get.mockResolvedValue(pagina([clienteDeLista(item)], 1))
    const qc = pintar(<Pantalla />)
    await screen.findByText(fila)

    get.mockRejectedValue(SIN_RED())
    await act(async () => { await qc.refetchQueries() })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByText(fila)).toBeTruthy()
    expect(screen.queryByRole('header', { name: falla })).toBeNull()
  })

  it('otro error sin datos sigue siendo el aviso con el mensaje del servidor', async () => {
    get.mockRejectedValue(new Error('No tenés permisos para esta acción.'))
    pintar(<Pantalla />)

    expect(await screen.findByText('No tenés permisos para esta acción.')).toBeTruthy()
    expect(screen.queryByRole('header', { name: falla })).toBeNull()
  })
})
