import { act, renderHook, waitFor } from '@testing-library/react-native'
import NetInfo from '@react-native-community/netinfo'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
  zustandStorage: { setItem: () => undefined, getItem: () => null, removeItem: () => undefined },
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  API_URL: '',
}))
type Oyente = (s: { isConnected: boolean; isInternetReachable: boolean }) => void
const mockOyentes: Oyente[] = []
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((o: Oyente) => { mockOyentes.push(o); return () => undefined }),
}))

import { encolarVenta } from '../lib/cola'
import { useVentasSinSenal, esperaDeReintento } from '../hooks/useVentasSinSenal'

const post = api.post as jest.Mock
const get = api.get as jest.Mock
const alta = (): AltaVenta => ({
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: '',
})
const vista = { estadoResultante: 'Confirmada', requiereAutorizacion: false, motivos: [], rechazos: [], productosSinStock: [], total: 600, lineas: [{ productoId: 'p1', precioBase: 100 }] }
const conexion = (online: boolean) => act(async () => { mockOyentes.forEach((o) => o({ isConnected: online, isInternetReachable: online })) })
/** Deja correr las promesas pendientes (la ronda de envío encadena varias). */
const vaciar = () => act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve() })
/** Con timers reales: deja terminar todo lo pendiente. */
const drenar = () => act(async () => { await new Promise((r) => setImmediate(r)) })
const altas = () => post.mock.calls.filter(([u]) => u === '/api/v1/Ventas')

beforeEach(() => {
  mockDisco.clear()
  mockOyentes.length = 0
  jest.clearAllMocks()
  useAuthStore.setState({ user: { id: 'u1' } as never })
  get.mockResolvedValue({ venta: { codigoPedido: 'A1', estado: 2 } })
})

describe('useVentasSinSenal', () => {
  it('cuando vuelve la señal manda lo que espera, una sola vez aunque lleguen dos avisos juntos', async () => {
    let hayRed = false
    post.mockImplementation(async (url: string) => {
      if (!hayRed) throw new TypeError('Network request failed')
      return url.endsWith('vista-previa') ? vista : { ventaId: 'v1', version: 1, message: '', estado: 2 }
    })
    encolarVenta('u1', { alta: alta(), cliente: { direccion: 'Alem 3669' }, visto: { total: 600, precios: { p1: 100 } } })
    const { result } = renderHook(() => useVentasSinSenal())
    expect(NetInfo.addEventListener).toHaveBeenCalled()
    await drenar()
    expect(post).toHaveBeenCalledTimes(1) // el intento al abrir
    await conexion(false)
    expect(result.current.esperando).toHaveLength(1)
    hayRed = true
    await conexion(true)
    await conexion(true)
    await drenar()
    await waitFor(() => expect(result.current.enviadas).toHaveLength(1))
    expect(altas()).toHaveLength(1)
    expect(result.current.esperando).toHaveLength(0)
  })

  it('mientras no hay señal no reintenta; al volver, sí', async () => {
    jest.useFakeTimers()
    try {
      post.mockRejectedValue(new TypeError('Network request failed'))
      encolarVenta('u1', { alta: alta(), cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
      const { result } = renderHook(() => useVentasSinSenal())
      // Al abrir, hasta que NetInfo diga otra cosa, la app se cree con señal (useNetworkStatus) y prueba una vez.
      await vaciar()
      const alAbrir = post.mock.calls.length
      await conexion(false)
      expect(result.current.sinSenal).toBe(true)
      await act(async () => { jest.advanceTimersByTime(esperaDeReintento(5)) })
      expect(post.mock.calls.length).toBe(alAbrir)
      await conexion(true)
      await vaciar()
      expect(post.mock.calls.length).toBe(alAbrir + 1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('muestra lo que se encola mientras la pantalla está abierta', async () => {
    const { result } = renderHook(() => useVentasSinSenal())
    await conexion(false)
    expect(result.current.esperando).toHaveLength(0)
    act(() => { encolarVenta('u1', { alta: alta(), cliente: {}, visto: { total: 600, precios: { p1: 100 } } }) })
    expect(result.current.esperando).toHaveLength(1)
  })

  it('si falla por la red reintenta más tarde, cada vez esperando más (hasta 10 minutos)', async () => {
    jest.useFakeTimers()
    try {
      post.mockRejectedValue(new TypeError('Network request failed'))
      encolarVenta('u1', { alta: alta(), cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
      renderHook(() => useVentasSinSenal())
      await vaciar()
      const tras1 = post.mock.calls.length
      expect(tras1).toBe(1)
      await act(async () => { jest.advanceTimersByTime(esperaDeReintento(1) - 1) })
      expect(post.mock.calls.length).toBe(tras1)
      await act(async () => { jest.advanceTimersByTime(1) })
      expect(post.mock.calls.length).toBe(tras1 + 1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('la espera crece y tiene tope', () => {
    expect(esperaDeReintento(1)).toBe(15_000)
    expect(esperaDeReintento(2)).toBe(30_000)
    expect(esperaDeReintento(3)).toBe(60_000)
    expect(esperaDeReintento(20)).toBe(600_000)
  })
})
