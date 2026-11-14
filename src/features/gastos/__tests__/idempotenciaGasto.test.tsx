import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRegistrarGasto } from '../api/gastos'
import { useRegistrarMovimientoInterno } from '@/features/tesoreria/api/movimientosInternos'
import { api } from '@/core/api/client'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
}))

const post = api.post as jest.Mock
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const claveDe = (url: string, n: number) => post.mock.calls.filter((c) => c[0] === url)[n][1].claveIdempotencia as string

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  post.mockResolvedValue('id')
})

const gasto = { descripcion: 'Luz', monto: 1000, moneda: 'ARS' } as never
const movimiento = { monto: 500, moneda: 'ARS', cuentaOrigenId: 'a', cuentaDestinoId: 'b' } as never

describe.each([
  ['gasto', '/api/v1/gastos', useRegistrarGasto, gasto],
  ['movimiento entre cuentas', '/api/v1/movimientos-internos', useRegistrarMovimientoInterno, movimiento],
] as const)('%s: una clave por intento', (_nombre, url, usar, payload) => {
  it('manda la clave sin cambiar el resto del cuerpo', async () => {
    const { result } = renderHook(() => usar(), { wrapper })
    await act(async () => { await result.current.mutateAsync(payload) })
    expect(post).toHaveBeenCalledWith(url, { ...(payload as object), claveIdempotencia: expect.stringMatching(/^mobile-/) })
  })

  it('un doble toque y el reintento tras un corte repiten la clave; después de grabar sale otra', async () => {
    post.mockRejectedValueOnce(new Error('Network request failed'))
    const { result } = renderHook(() => usar(), { wrapper })
    await act(async () => { await result.current.mutateAsync(payload).catch(() => undefined) })
    await act(async () => { await Promise.all([result.current.mutateAsync(payload), result.current.mutateAsync(payload)]) })
    expect(claveDe(url, 1)).toBe(claveDe(url, 0))
    expect(claveDe(url, 2)).toBe(claveDe(url, 0))
    await act(async () => { await result.current.mutateAsync(payload) })
    expect(claveDe(url, 3)).not.toBe(claveDe(url, 0))
  })

  it('si el usuario cambió el monto tras un error es otro intento: otra clave', async () => {
    post.mockRejectedValueOnce(new Error('400'))
    const { result } = renderHook(() => usar(), { wrapper })
    await act(async () => { await result.current.mutateAsync(payload).catch(() => undefined) })
    await act(async () => { await result.current.mutateAsync({ ...(payload as object), monto: 1 } as never) })
    expect(claveDe(url, 1)).not.toBe(claveDe(url, 0))
  })
})
