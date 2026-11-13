import React from 'react'
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react-native'

let mockEnfocar: (() => void | (() => void)) | null = null
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => { mockEnfocar = cb },
}))
jest.unmock('@/core/hooks/useRefrescarAlEnfocar')
import { useRefrescarAlEnfocar } from '../useRefrescarAlEnfocar'

const flush = () => new Promise((r) => setImmediate(r))

describe('useRefrescarAlEnfocar', () => {
  it('no hace nada en el primer foco; después refresca lo vencido y no lo fresco', async () => {
    const qc = new QueryClient()
    const vencida = jest.fn().mockResolvedValue(1)
    const fresca = jest.fn().mockResolvedValue(1)
    const bajas = [
      new QueryObserver(qc, { queryKey: ['a'], queryFn: vencida, staleTime: 0 }).subscribe(() => undefined),
      new QueryObserver(qc, { queryKey: ['b'], queryFn: fresca, staleTime: 60_000 }).subscribe(() => undefined),
    ]
    await flush()
    vencida.mockClear(); fresca.mockClear()

    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    renderHook(() => useRefrescarAlEnfocar(), { wrapper })

    mockEnfocar!() // primer foco: la pantalla recién montada
    await flush()
    expect(vencida).not.toHaveBeenCalled()

    mockEnfocar!() // vuelve a la pantalla
    await flush()
    expect(vencida).toHaveBeenCalledTimes(1)
    expect(fresca).not.toHaveBeenCalled()
    bajas.forEach((b) => b())
  })

  it('con claves solo refresca esas raíces', async () => {
    const qc = new QueryClient()
    const a = jest.fn().mockResolvedValue(1)
    const b = jest.fn().mockResolvedValue(1)
    const bajas = [
      new QueryObserver(qc, { queryKey: ['a', 1], queryFn: a, staleTime: 0 }).subscribe(() => undefined),
      new QueryObserver(qc, { queryKey: ['b', 1], queryFn: b, staleTime: 0 }).subscribe(() => undefined),
    ]
    await flush()
    a.mockClear(); b.mockClear()
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    renderHook(() => useRefrescarAlEnfocar([['a']]), { wrapper })
    mockEnfocar!(); mockEnfocar!()
    await flush()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    bajas.forEach((x) => x())
  })
})
