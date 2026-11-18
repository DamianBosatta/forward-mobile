import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

import { ApiError } from '@/core/api/client'
import { TOPE_DE_INTENTOS } from '@/core/utils/colasSinSenal'
import { cambiarEstado, encolarAccion, leerCola, reintentarAccion } from '../cola/colaConsola'
import { useEnvioConsolaSinSenal } from '../cola'

/**
 * Envío de la cola de la consola (chofer-01-viaje--sin-senal): con señal manda lo que espera, en orden y una sola vez;
 * sin señal no manda nada y no pierde nada.
 */

const post = api.post as jest.Mock
const conexion = (online: boolean) => act(async () => { mockOyentes.forEach((o) => o({ isConnected: online, isInternetReachable: online })) })
const drenar = () => act(async () => { await new Promise((r) => setImmediate(r)) })
const entregar = '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'

const envoltura = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const encolar = () =>
  encolarAccion('u1', {
    clave: 'mobile-k1', hojaDeRutaId: 'h1', paradaId: 'p1', clienteNombre: 'Abel',
    tipo: 'entrega', cuerpo: { claveIdempotencia: 'mobile-k1' } as never, cobrado: 0, conDevolucion: false,
  })

beforeEach(() => {
  mockDisco.clear()
  mockOyentes.length = 0
  jest.clearAllMocks()
  useAuthStore.setState({ user: { id: 'u1' } as never })
})

describe('useEnvioConsolaSinSenal', () => {
  it('no manda nada mientras no hay señal y lo manda una sola vez, con su clave, cuando vuelve', async () => {
    post.mockResolvedValue({ paradaId: 'p1', repetida: false })
    renderHook(() => useEnvioConsolaSinSenal(), { wrapper: envoltura })
    await conexion(false)
    act(() => { encolar() })
    await drenar()
    expect(post).not.toHaveBeenCalled()
    expect(leerCola('u1')).toHaveLength(1)
    await conexion(true)
    await conexion(true)
    await drenar()
    expect(post.mock.calls.filter(([u]) => u === entregar)).toHaveLength(1)
    expect(post).toHaveBeenCalledWith(entregar, { claveIdempotencia: 'mobile-k1', resueltaEn: expect.stringContaining('T') })
    expect(leerCola('u1')).toEqual([])
  })

  it('si el pedido no llega la acción sigue esperando, con un intento más', async () => {
    post.mockRejectedValue(new TypeError('Network request failed'))
    encolar()
    renderHook(() => useEnvioConsolaSinSenal(), { wrapper: envoltura })
    await conexion(true)
    await drenar()
    expect(leerCola('u1')).toEqual([expect.objectContaining({ clave: 'mobile-k1', estado: { tipo: 'esperando', intentos: 1, fallosDelTope: 0 } })])
  })

  it('Reintentar mientras la ronda manda otra acción: la detenida por el tope sale de nuevo, una vez y con la misma clave, sin esperar a que cambie la señal', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
    try {
      const enc = (clave: string, paradaId: string, t: number) => encolarAccion('u1', {
        clave, hojaDeRutaId: 'h1', paradaId, clienteNombre: 'X', tipo: 'entrega', cuerpo: { claveIdempotencia: clave } as never, cobrado: 0, conDevolucion: false,
      }, t)
      enc('a', 'p1', 1000)
      enc('b', 'p2', 2000)
      cambiarEstado('u1', 'a', { tipo: 'esperando', intentos: TOPE_DE_INTENTOS - 1, fallosDelTope: TOPE_DE_INTENTOS - 1 })
      let soltar: (v: unknown) => void = () => undefined
      post.mockRejectedValueOnce(new ApiError(503, 'Servicio no disponible', []))
        .mockImplementationOnce(() => new Promise((r) => { soltar = r }))
        .mockResolvedValue({})
      renderHook(() => useEnvioConsolaSinSenal(), { wrapper: envoltura })
      await conexion(true)
      await drenar()
      expect(leerCola('u1').map((x) => [x.clave, x.estado.tipo])).toEqual([['a', 'revisar'], ['b', 'esperando']])
      act(() => { reintentarAccion('u1', 'a') })
      await act(async () => { soltar({}) })
      await drenar()
      await act(async () => { jest.advanceTimersByTime(60 * 60_000) })
      await drenar()
      const urls = post.mock.calls.map(([u]) => u)
      expect(urls).toEqual([entregar, '/api/v1/Logistica/hojas-ruta/h1/paradas/p2/entregar', entregar])
      expect(post.mock.calls[2]).toEqual(post.mock.calls[0])
      expect(leerCola('u1')).toEqual([])
    } finally {
      jest.useRealTimers()
    }
  })
})
