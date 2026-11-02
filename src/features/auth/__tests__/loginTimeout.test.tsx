import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/auth.store'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

/** A fetch that never answers; it only rejects when the request is aborted, like the real one. */
const fetchColgado = () =>
  jest.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
  }))

const respuesta = (ok: boolean, cuerpo: unknown = {}) => ({ ok, status: ok ? 200 : 500, json: async () => cuerpo }) as unknown as Response

describe('login goes through fetchWithTimeout', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('times out like any other request: a token endpoint that never answers fails the login', async () => {
    jest.useFakeTimers()
    global.fetch = fetchColgado() as unknown as typeof fetch
    const { result } = renderHook(() => useAuth(), { wrapper })

    let intento!: Promise<boolean>
    act(() => {
      intento = result.current.login('admin', '123')
    })
    let exito: boolean | undefined
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000)
      exito = await intento
    })

    expect(exito).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('El servidor tardó demasiado en responder. Intentá de nuevo.')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('a false from refreshPermissions is a failed login: no success, no session left behind', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/connect/token')) return respuesta(true, { access_token: 'a', refresh_token: 'r' })
      return respuesta(false)
    }) as unknown as typeof fetch
    const { result } = renderHook(() => useAuth(), { wrapper })

    let exito: boolean | undefined
    await act(async () => {
      exito = await result.current.login('admin', '123')
    })

    expect(exito).toBe(false)
    expect(result.current.error).toBe('No pudimos cargar tus permisos. Intentá de nuevo.')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
