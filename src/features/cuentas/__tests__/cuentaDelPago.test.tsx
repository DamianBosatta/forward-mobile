/**
 * REQ-02: a cobro whose response does not name the account (`tipoCuenta: null`: a 409 on the key, or an older server)
 * is located by the movement that carries its `pagoId`. The path stays: the 409 envelope never carries the account.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { useCuentaDelPago } from '../api/cobros'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (url: string) => mockGet(url) } }))

const envolver = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const CUENTAS = { cuentaId: 'tst-1', cuentaNormalId: 'normal-1' }

describe('useCuentaDelPago sin tipoCuenta', () => {
  beforeEach(() => mockGet.mockReset())

  it('finds the account whose first movements page carries the pagoId', async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ movimientos: { items: url.includes('normal-1') ? [{ pagoId: 'p9' }] : [{ pagoId: 'otro' }] } }))
    const { result } = renderHook(() => useCuentaDelPago({ pagoId: 'p9', tipoCuenta: null }, CUENTAS), { wrapper: envolver() })
    expect(result.current.buscando).toBe(true)
    await waitFor(() => expect(result.current.cuenta).toBe('Normal'))
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('does not search when the server named the account', () => {
    const { result } = renderHook(() => useCuentaDelPago({ pagoId: 'p9', tipoCuenta: 'Tst' }, CUENTAS), { wrapper: envolver() })
    expect(result.current).toEqual({ cuenta: 'Tst', buscando: false })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('returns no account when no movement carries the pagoId', async () => {
    mockGet.mockResolvedValue({ movimientos: { items: [] } })
    const { result } = renderHook(() => useCuentaDelPago({ pagoId: 'p9', tipoCuenta: null }, CUENTAS), { wrapper: envolver() })
    await waitFor(() => expect(result.current.buscando).toBe(false))
    expect(result.current.cuenta).toBeNull()
  })
})
