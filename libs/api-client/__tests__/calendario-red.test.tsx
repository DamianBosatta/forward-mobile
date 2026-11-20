import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useCrearEvento } from '../calendario'
import { api } from '@/core/api/client'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn() }, API_URL: 'x' }))

const mockPost = api.post as jest.Mock
const evento = { tipo: 'Manual', titulo: 't', fechaInicio: '2026-11-20', socioComercialId: 's', avisarDiasAntes: 0, visibilidad: 'Personal' } as const
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  onlineManager.setOnline(false)
})
afterEach(() => onlineManager.setOnline(true))

describe('useCrearEvento sin red', () => {
  it('por defecto la mutación queda en pausa hasta que vuelve la red (como el resto)', async () => {
    mockPost.mockResolvedValue('e1')
    const { result } = renderHook(() => useCrearEvento(), { wrapper })
    act(() => { void result.current.mutateAsync(evento as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(result.current.isPaused).toBe(true)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('con networkMode "always" sale en el acto y el error de red rechaza sin dejar nada en pausa', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    const { result } = renderHook(() => useCrearEvento({ networkMode: 'always' }), { wrapper })
    let resultado = 'pendiente'
    await act(async () => {
      await result.current.mutateAsync(evento as never).then(() => { resultado = 'ok' }, () => { resultado = 'rechazada' })
    })
    expect(resultado).toBe('rechazada')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(qc.getMutationCache().getAll().filter((m) => m.state.isPaused)).toHaveLength(0)
  })
})
