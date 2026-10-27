/**
 * Bloque 12, T13c (lienzo R16): Catálogo y Stock muestran "vacío" y "sin conexión" con el componente
 * de estados de pantalla. Las frases de hoy no cambian.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import CatalogoScreen from '../../../../app/(tabs)/inventario/index'
import StockScreen from '../../../../app/(tabs)/inventario/stock'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'

jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390 }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useLocalSearchParams: () => ({}), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }
jest.setTimeout(15_000)

const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })
const FILA = {
  id: 's1', productoId: 'p1', producto: 'Make Lavajean', codigoPropio: 'PRO06787', depositoId: DEPOSITO_CENTRAL_ID, deposito: 'Central',
  cantidadActual: 14, cantidadVirtual: 0, cantidadTransito: 0, cantidadReservada: 0, cantidadDisponible: 8, stockMinimo: 0, enAlerta: false,
}
const RESUMEN = { totales: { filas: 1, articulos: 1, sinStock: 0, enAlerta: 0, conStock: 1, sinPeso: 0 }, depositos: [], lineas: [], marcas: [] }

let stocks: () => Promise<unknown>
let productos: () => Promise<unknown>
function servidor(url: string) {
  if (url.startsWith('/api/v1/Stocks/resumen')) return Promise.resolve(RESUMEN)
  if (url.startsWith('/api/v1/Stocks?')) return stocks()
  if (url.startsWith('/api/v1/Productos?')) return productos()
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

function conUsuario(conCantidades: boolean) {
  useAuthStore.setState({
    user: {
      id: 'u1', username: 'u', roles: ['Vendedor'] as never,
      permissions: [{ module: 'MOD_STOCK', canRead: true }, ...(conCantidades ? [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }] : [])] as never,
    },
  })
}

function pintar(Pantalla: React.ComponentType = StockScreen) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(<QueryClientProvider client={qc}><Pantalla /></QueryClientProvider>)
  return qc
}
const abrirStock = async () => { await screen.findByLabelText('Buscar por código o nombre') }
const SIN_RED = () => new TypeError('Network request failed')

beforeEach(() => {
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([])
  stocks = () => Promise.resolve(pagina([FILA]))
  productos = () => Promise.resolve(pagina([]))
  conUsuario(true)
})

const PRODUCTO = { id: 'p1', nombre: 'Make Lavajean', codigoPropio: 'PRO06787', esPadreDeVariantes: false, activo: true }

describe('Catálogo', () => {
  it('sin productos: estado "vacío" con la frase de siempre', async () => {
    pintar(CatalogoScreen)
    expect(await screen.findByRole('header', { name: 'No hay productos que coincidan con la búsqueda.' })).toBeTruthy()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    productos = () => Promise.reject(SIN_RED())
    pintar(CatalogoScreen)

    expect(await screen.findByRole('header', { name: 'No pudimos cargar el catálogo' })).toBeTruthy()
    productos = () => Promise.resolve(pagina([PRODUCTO]))
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Make Lavajean')).toBeTruthy()
  })

  it('con lo guardado y sin conexión: la lista sigue y un aviso dice a qué hora se guardó', async () => {
    productos = () => Promise.resolve(pagina([PRODUCTO]))
    const qc = pintar(CatalogoScreen)
    await screen.findByText('Make Lavajean')

    productos = () => Promise.reject(SIN_RED())
    await act(async () => { await qc.refetchQueries() })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByText('Make Lavajean')).toBeTruthy()
  })

  it('otro error sin datos sigue siendo el aviso de siempre', async () => {
    productos = () => Promise.reject(new Error('boom'))
    pintar(CatalogoScreen)
    expect(await screen.findByText('No se pudo cargar el catálogo. Revisá la conexión y volvé a intentar.')).toBeTruthy()
  })
})

describe('Stock con cantidades', () => {
  it('sin renglones: estado "vacío" con la frase de siempre', async () => {
    stocks = () => Promise.resolve(pagina([]))
    pintar()
    await abrirStock()
    expect(await screen.findByRole('header', { name: 'No hay productos que coincidan.' })).toBeTruthy()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    stocks = () => Promise.reject(SIN_RED())
    pintar()
    await abrirStock()

    expect(await screen.findByRole('header', { name: 'No pudimos cargar el stock' })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()

    stocks = () => Promise.resolve(pagina([FILA]))
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Make Lavajean')).toBeTruthy()
  })

  it('con lo guardado y sin conexión: la lista sigue y un aviso dice a qué hora se guardó', async () => {
    const qc = pintar()
    await abrirStock()
    await screen.findByText('Make Lavajean')

    stocks = () => Promise.reject(SIN_RED())
    await act(async () => { await qc.refetchQueries({ queryKey: ['stock-consulta', 'lista'] }) })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByText('Make Lavajean')).toBeTruthy()
  })

  it('otro error sin datos sigue siendo el aviso de siempre', async () => {
    stocks = () => Promise.reject(new Error('boom'))
    pintar()
    await abrirStock()

    expect(await screen.findByText('No se pudo cargar el stock. Revisá la conexión y volvé a intentar.')).toBeTruthy()
    expect(screen.queryByRole('header', { name: 'No pudimos cargar el stock' })).toBeNull()
  })
})

describe('Stock sin cantidades', () => {
  it('sin productos: estado "vacío" con la frase de siempre', async () => {
    conUsuario(false)
    pintar()
    await abrirStock()
    expect(await screen.findByRole('header', { name: 'No hay productos que coincidan con la búsqueda.' })).toBeTruthy()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar', async () => {
    conUsuario(false)
    productos = () => Promise.reject(SIN_RED())
    pintar()
    await abrirStock()
    expect(await screen.findByRole('header', { name: 'No pudimos cargar el stock' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
