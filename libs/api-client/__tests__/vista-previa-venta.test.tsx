import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVistaPreviaVenta } from '../ventas'
import { api } from '../client'

jest.mock('../client', () => ({ api: { post: jest.fn() }, API_URL: 'x' }))

const post = api.post as jest.Mock

function envoltorio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  post.mockReset()
})

describe('useVistaPreviaVenta', () => {
  it('keeps the previous preview on screen while the body changes (typing)', async () => {
    post.mockResolvedValueOnce({ id: 'a' })
    post.mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(
      ({ cuerpo }: { cuerpo: object | null }) => useVistaPreviaVenta(cuerpo, true),
      { wrapper: envoltorio(), initialProps: { cuerpo: { lineas: 1 } as object | null } },
    )
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a' }))
    rerender({ cuerpo: { lineas: 2 } })
    expect(result.current.data).toEqual({ id: 'a' })
  })

  it('returns no preview once the cart is empty (no body)', async () => {
    post.mockResolvedValueOnce({ id: 'a' })
    const { result, rerender } = renderHook(
      ({ cuerpo }: { cuerpo: object | null }) => useVistaPreviaVenta(cuerpo, true),
      { wrapper: envoltorio(), initialProps: { cuerpo: { lineas: 1 } as object | null } },
    )
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a' }))
    rerender({ cuerpo: null })
    expect(result.current.data).toBeUndefined()
  })
})
