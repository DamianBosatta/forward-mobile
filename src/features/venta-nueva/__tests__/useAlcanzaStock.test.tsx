import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useAlcanzaStock } from '../hooks/useAlcanzaStock'
import { useDepositoElegidoStore } from '../hooks/useDepositoDeVenta'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), put: jest.fn(), post: (...a: unknown[]) => mockPost(...a) },
}))

let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const pedir = (cantidad: number) => [{ productoId: 'p1', cantidad }]
/** Avanza el reloj y deja que las promesas y el scheduler de react-query terminen. */
const avanzar = async (ms: number) => {
  await act(async () => { jest.advanceTimersByTime(ms) })
  await act(async () => { jest.advanceTimersByTime(10) })
}
const cuerpo = (llamada: unknown[]) => (llamada[1] as { items: { cantidad: number }[] }).items[0].cantidad

beforeEach(() => {
  jest.useFakeTimers()
  mockPost.mockReset()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
})
afterEach(() => jest.useRealTimers())

describe('useAlcanzaStock: la cantidad tipeada se consulta una sola vez', () => {
  it('varios cambios seguidos mandan un solo pedido, con el valor final', async () => {
    mockPost.mockResolvedValue([{ productoId: 'p1', disponible: true }])
    const { rerender } = renderHook(({ n }: { n: number }) => useAlcanzaStock(pedir(n)), { wrapper, initialProps: { n: 1 } })
    await avanzar(500)
    mockPost.mockClear()
    for (const n of [5, 50, 500]) {
      rerender({ n })
      await avanzar(100)
    }
    expect(mockPost).not.toHaveBeenCalled()
    await avanzar(500)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(cuerpo(mockPost.mock.calls[0])).toBe(500)
  })

  it('una respuesta lenta de un valor anterior no pisa la del valor nuevo', async () => {
    let soltarLenta: (v: unknown) => void = () => {}
    mockPost
      .mockImplementationOnce(() => new Promise((r) => { soltarLenta = r }))
      .mockResolvedValueOnce([{ productoId: 'p1', disponible: true }])
    const { result, rerender } = renderHook(({ n }: { n: number }) => useAlcanzaStock(pedir(n)), { wrapper, initialProps: { n: 50 } })
    await avanzar(500)
    rerender({ n: 5 })
    await avanzar(500)
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(result.current.noAlcanzan.size).toBe(0)
    await act(async () => { soltarLenta([{ productoId: 'p1', disponible: false }]) })
    await avanzar(10)
    expect(result.current.noAlcanzan.size).toBe(0)
    expect(result.current.revisando).toBe(false)
  })

  it('avisa los productos que no alcanzan y mientras se espera dice que está revisando', async () => {
    mockPost.mockResolvedValue([{ productoId: 'p1', disponible: false }])
    const { result } = renderHook(() => useAlcanzaStock(pedir(50)), { wrapper })
    expect(result.current.revisando).toBe(true)
    await avanzar(500)
    expect([...result.current.noAlcanzan]).toEqual(['p1'])
    expect(result.current.revisando).toBe(false)
  })

  it('quien ve cantidades no consulta', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }] } as never })
    const { result } = renderHook(() => useAlcanzaStock(pedir(50)), { wrapper })
    await avanzar(1000)
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.revisando).toBe(false)
  })
})

describe('useAlcanzaStock: depósito de la venta (S18)', () => {
  afterEach(() => useDepositoElegidoStore.setState({ elegido: null }))

  it('consulta la disponibilidad en el depósito elegido, el mismo que va en la venta', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], depositoId: 'dep-propio', permissions: [] } as never })
    useDepositoElegidoStore.setState({ elegido: 'dep-otro' })
    mockPost.mockResolvedValue([{ productoId: 'p1', disponible: true }])
    renderHook(() => useAlcanzaStock(pedir(5)), { wrapper })
    await avanzar(500)
    expect(mockPost.mock.calls[0][1]).toMatchObject({ depositoId: 'dep-otro' })
  })
})
