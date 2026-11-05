import { act, renderHook } from '@testing-library/react-native'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'

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
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
  stopLocationUpdatesAsync: jest.fn(),
}))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))

import { encolarPosiciones, leerPosiciones } from '../colaPosiciones'
import { useEnvioPosiciones } from '../useEnvioPosiciones'

/** Lo que quedó sin subir sale solo cuando hay señal y sin esperar otra lectura del GPS (S5). */
const post = api.post as jest.Mock
const conexion = (online: boolean) => act(async () => { mockOyentes.forEach((o) => o({ isConnected: online, isInternetReachable: online })) })
const posicion = (registradaEn: string) => ({ hojaDeRutaId: 'h1', latitud: -34.6, longitud: -58.4, registradaEn })
const pasar = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  jest.useFakeTimers()
  mockDisco.clear()
  mockOyentes.length = 0
  post.mockReset()
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1' } } as never)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useEnvioPosiciones', () => {
  it('sin señal no manda ni pierde nada; al volver sube lo guardado con su hora original', async () => {
    encolarPosiciones('u1', [posicion('2026-11-05T10:00:00.000Z')])
    post.mockResolvedValue({ recibidas: 1, descartadas: 0 })
    renderHook(() => useEnvioPosiciones())
    await conexion(false)
    post.mockClear()
    encolarPosiciones('u1', [posicion('2026-11-05T10:01:00.000Z')])
    await pasar(120_000)
    expect(post).not.toHaveBeenCalled()
    await conexion(true)
    await pasar(0)
    expect(post).toHaveBeenCalledTimes(1)
    const [url, cuerpo] = post.mock.calls[0]
    expect(url).toBe('/api/v1/Logistica/hojas-ruta/h1/posiciones')
    expect(cuerpo.posiciones.map((p: { registradaEn: string }) => p.registradaEn)).toContain('2026-11-05T10:01:00.000Z')
    expect(leerPosiciones('u1')).toEqual([])
  })

  it('si el envío falla, reintenta recién al minuto y no pierde nada', async () => {
    encolarPosiciones('u1', [posicion('2026-11-05T10:00:00.000Z')])
    post.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({ recibidas: 1, descartadas: 0 })
    renderHook(() => useEnvioPosiciones())
    await conexion(true)
    await pasar(0)
    const tras = post.mock.calls.length
    await pasar(59_000)
    expect(post.mock.calls.length).toBe(tras)
    await pasar(2_000)
    expect(post.mock.calls.length).toBe(tras + 1)
    expect(leerPosiciones('u1')).toEqual([])
  })

  it('si la ronda cortó por el tope, sigue sola al minuto', async () => {
    const muchas = Array.from({ length: 720 }, (_, i) => posicion(new Date(Date.UTC(2026, 10, 5, 0, i)).toISOString()))
    encolarPosiciones('u1', muchas)
    post.mockResolvedValue({ recibidas: 120, descartadas: 0 })
    renderHook(() => useEnvioPosiciones())
    await conexion(true)
    await pasar(0)
    expect(post).toHaveBeenCalledTimes(5)
    expect(leerPosiciones('u1')).toHaveLength(120)
    await pasar(61_000)
    expect(post).toHaveBeenCalledTimes(6)
    expect(leerPosiciones('u1')).toEqual([])
  })
})
