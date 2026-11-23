import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReabrirPresupuesto } from '../../hooks/useReabrirPresupuesto'
import { api } from '@/core/api/client'

jest.mock('@/core/api/client', () => ({ api: { post: jest.fn() }, API_URL: 'x' }))

const post = api.post as jest.Mock
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const hook = () => renderHook(() => useReabrirPresupuesto(), { wrapper })
const claveDe = (i: number) => (post.mock.calls[i][1] as { claveIdempotencia?: string } | undefined)?.claveIdempotencia

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  post.mockResolvedValue({})
})

describe('POST /Ventas/{id}/reabrir: una clave de idempotencia por intento', () => {
  it('manda la clave en el cuerpo, que antes iba vacío, y la misma URL', async () => {
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync('v9') })
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]).toEqual(['/api/v1/Ventas/v9/reabrir', { claveIdempotencia: expect.stringMatching(/^mobile-./) }])
  })

  it('el reintento tras un corte de red repite la misma clave', async () => {
    post.mockRejectedValueOnce(new Error('Network request failed'))
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync('v9').catch(() => undefined) })
    await act(async () => { await result.current.mutateAsync('v9') })
    expect(post).toHaveBeenCalledTimes(2)
    expect(claveDe(0)).toMatch(/^mobile-/)
    expect(claveDe(1)).toBe(claveDe(0))
  })

  it('después de reabrir, la próxima acción del usuario usa otra clave', async () => {
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync('v9') })
    await act(async () => { await result.current.mutateAsync('v9') })
    expect(claveDe(0)).toMatch(/^mobile-/)
    expect(claveDe(1)).not.toBe(claveDe(0))
  })

  it('otro presupuesto con la primera todavía sin grabar usa otra clave (el id de la ruta cuenta)', async () => {
    post.mockRejectedValueOnce(new Error('Network request failed'))
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync('v9').catch(() => undefined) })
    await act(async () => { await result.current.mutateAsync('v8') })
    expect(post.mock.calls[1][0]).toBe('/api/v1/Ventas/v8/reabrir')
    expect(claveDe(0)).toMatch(/^mobile-/)
    expect(claveDe(1)).not.toBe(claveDe(0))
  })
})
