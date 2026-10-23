import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'
import { producto } from '@/features/venta-nueva/__testing__/producto'

const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
  zustandStorage: { setItem: () => undefined, getItem: () => null, removeItem: () => undefined },
}))
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => () => undefined) }))
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: (...a: unknown[]) => mockGet(...a) } }))
// El stock en vivo no abre una conexión de verdad: el test dispara la conexión a mano.
const mockHub: { oyentes: Set<{ alConectar: () => void; alEstado: (v: boolean) => void }>; cantidades: boolean } = { oyentes: new Set(), cantidades: true }
jest.mock('@/core/realtime/stockEnVivo', () => ({
  ...jest.requireActual('@/core/realtime/stockEnVivo'),
  gestorStock: {
    suscribir: (_ids: string[], o: never) => { mockHub.oyentes.add(o); return () => mockHub.oyentes.delete(o) },
    reintentar: jest.fn(),
    enVivo: () => false,
    veCantidades: () => mockHub.cantidades,
  },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

import { cambiarEstado, encolarVenta } from '../lib/cola'
import { PendientesDeEnviar } from '../components/PendientesDeEnviar'

const alta: AltaVenta = {
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-p1',
}
const montar = () => render(<QueryClientProvider client={new QueryClient()}><PendientesDeEnviar /></QueryClientProvider>)

const conectar = () => act(() => mockHub.oyentes.forEach((o) => { o.alEstado(true); o.alConectar() }))
const catalogo = (disponible: number) => mockGet.mockResolvedValue({ items: [producto({ id: 'p1', nombre: 'Producto X', disponible })], hasNextPage: false })
beforeEach(() => { mockDisco.clear(); mockPush.mockReset(); mockGet.mockReset(); catalogo(50); mockHub.cantidades = true; mockHub.oyentes.clear(); useAuthStore.setState({ user: { id: 'u1' } as never }) })

it('sin ventas en el teléfono no dibuja nada', () => {
  expect(montar().toJSON()).toBeNull()
})

it('con ventas del usuario muestra el bloque "Pendientes de enviar" con la venta que espera', () => {
  encolarVenta('u1', { alta, cliente: { razonSocial: 'Almacén Luis' } as never, visto: { total: 600, precios: { p1: 100 } } })
  montar()
  expect(screen.getByText('Pendientes de enviar')).toBeTruthy()
  expect(screen.getByText('En el teléfono')).toBeTruthy()
})

it('no muestra las ventas de otro usuario', () => {
  encolarVenta('otro', { alta, cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
  expect(montar().toJSON()).toBeNull()
})

it('tocar una venta ya enviada abre su detalle', () => {
  encolarVenta('u1', { alta, cliente: { razonSocial: 'Almacén Luis' } as never, visto: { total: 600, precios: { p1: 100 } } })
  cambiarEstado('u1', 'mobile-p1', { tipo: 'enviada', ventaId: 'v9', codigo: 'A1', estado: null })
  montar()
  fireEvent.press(screen.getByText(/Almac/))
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/v9')
})

describe('al reconectar: líneas de la cola que cambiaron (S3)', () => {
  const encolar = () => encolarVenta('u1', { alta, cliente: { razonSocial: 'Almacén Luis' } as never, visto: { total: 600, precios: { p1: 100 } } })

  it('avisa qué líneas de las ventas guardadas ya no alcanzan, y la venta sigue en la cola para enviarse', async () => {
    catalogo(2)
    encolar()
    montar()
    conectar()
    expect(await screen.findByText(/Quedan 2 de Producto X \(la venta guardada lleva 6\)/)).toBeTruthy()
    expect(screen.getByText('En el teléfono')).toBeTruthy()
  })

  it('si el stock alcanza no avisa nada', async () => {
    encolar()
    montar()
    conectar()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/Quedan/)).toBeNull()
  })

  it('un usuario que no ve cantidades no recibe avisos con números inventados', async () => {
    mockHub.cantidades = false
    catalogo(0)
    encolar()
    montar()
    conectar()
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/stock/i)).toBeNull()
  })

  it('al (re)conectar vuelve a pedir el catálogo para comparar con el stock de ahora', async () => {
    encolar()
    montar()
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    catalogo(1)
    conectar()
    expect(await screen.findByText(/Quedan 1 de Producto X \(la venta guardada lleva 6\)/)).toBeTruthy()
  })
})
