import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/auth.store'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const rechazo = () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }) as unknown as Response

async function agotarIntentos(result: { current: ReturnType<typeof useAuth> }) {
  for (let i = 0; i < 5; i++) {
    await act(async () => { await result.current.login('admin', 'mala') })
    // The backoff between attempts doubles; wait it out.
    await act(async () => { await jest.advanceTimersByTimeAsync(20_000) })
  }
}

describe('login lockout timer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useAuthStore.getState().logout()
    global.fetch = jest.fn(async () => rechazo()) as unknown as typeof fetch
  })
  afterEach(() => { jest.useRealTimers() })

  it('lifts the lockout after 30 s (previous behavior)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await agotarIntentos(result)
    await act(async () => { await jest.advanceTimersByTimeAsync(31_000) })
    expect(result.current.isLocked).toBe(false)
  })

  it('leaves no pending timer once the hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper })
    await agotarIntentos(result)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
