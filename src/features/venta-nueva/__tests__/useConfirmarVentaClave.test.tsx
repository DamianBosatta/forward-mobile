import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { producto } from '../__testing__/producto'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), put: jest.fn(), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

const { ApiError } = jest.requireActual('@/core/api/client')
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const borrador = { borrador: null, cerrar: jest.fn(), descartar: jest.fn(), flush: jest.fn() }
const lineas = [{ productoId: 'p1', producto: producto({ disponible: 99 }), cantidad: 2, descuentoPct: 0 }]

const hook = () => renderHook(() => useConfirmarVenta({
  clienteId: 'c1', esPedido: true, lineas, descuentoGeneral: 0,
  cabecera: { metodoEntrega: 1 as never, fecha: '2026-10-30', flete: 0, observaciones: '' },
  borrador: borrador as never, alGuardar: jest.fn(),
}), { wrapper })
const claveDe = (n: number) => (mockPost.mock.calls[n][1] as { claveIdempotencia: string }).claveIdempotencia

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
  mockPost.mockResolvedValue({ ventaId: 'v1', message: 'ok', estado: 1 })
})

describe('useConfirmarVenta: clave de idempotencia por borrador', () => {
  it('después de confirmar con éxito, la venta siguiente usa una clave nueva', async () => {
    const { result } = hook()
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(claveDe(1)).not.toBe(claveDe(0))
  })

  it('reintentar el mismo borrador que no se confirmó reusa la misma clave', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(400, 'Dato inválido'))
    const { result } = hook()
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(claveDe(1)).toBe(claveDe(0))
  })
})
