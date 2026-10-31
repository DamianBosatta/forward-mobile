import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useRevalidarStockVenta } from '../hooks/useRevalidarStockVenta'
import { producto } from '../__testing__/producto'

let qc: QueryClient
let catalogoServidor: ReturnType<typeof producto>[]
// El servidor (no un `setQueryDefaults`, que taparía una consulta observada sin su propia mockQueryFn).
const mockQueryFn = jest.fn(async () => ({ items: catalogoServidor, hasNextPage: false }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockQueryFn(...(a as [])), put: jest.fn(), post: jest.fn() },
}))
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const CAP = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }

beforeEach(() => {
  mockQueryFn.mockClear()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Lo que se vio al cargar: p1 con 9, p2 con 4.
  const vistos = [producto({ id: 'p1', disponible: 9 }), producto({ id: 'p2', disponible: 4 })]
  qc.setQueryData(CLAVE_CATALOGO, { items: vistos, truncado: false })
  useCarritoVenta.setState({ lineas: vistos.map((p) => ({ productoId: p.id, producto: p, cantidad: 4, descuentoPct: 0 })) })
  catalogoServidor = [producto({ id: 'p1', disponible: 3 }), producto({ id: 'p2', disponible: 4 })]
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
})

afterEach(() => { onlineManager.setOnline(true) })

describe('useRevalidarStockVenta (S6: al revisar se vuelve a chequear)', () => {
  it('al abrir la revisión vuelve a pedir el catálogo y marca lo que cambió contra lo que se vio al cargar', async () => {
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.confirmado).toBe(true))
    expect(mockQueryFn).toHaveBeenCalledTimes(1)
    expect(result.current.cambios).toEqual([{ productoId: 'p1', antes: 9, ahora: 3, puedeVenderse: true }])
    // Las líneas que devuelve ya llevan el stock fresco.
    expect(result.current.lineas.find((l) => l.productoId === 'p1')!.producto.disponible).toBe(3)
  })

  it('revalidar() vuelve a pedir el catálogo y devuelve los cambios de ese momento', async () => {
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.confirmado).toBe(true))
    catalogoServidor = [producto({ id: 'p1', disponible: 3 }), producto({ id: 'p2', disponible: 1 })]
    let cambios: { productoId: string }[] = []
    await act(async () => { cambios = await result.current.revalidar() })
    expect(mockQueryFn).toHaveBeenCalledTimes(2)
    expect(cambios.map((c) => c.productoId)).toEqual(['p1', 'p2'])
  })

  it('un parche en vivo posterior también se marca', async () => {
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.confirmado).toBe(true))
    act(() => { qc.setQueryData(CLAVE_CATALOGO, { items: [producto({ id: 'p1', disponible: 3 }), producto({ id: 'p2', disponible: 0, puedeVenderse: false })], truncado: false }) })
    await waitFor(() => expect(result.current.cambios.map((c) => c.productoId)).toEqual(['p1', 'p2']))
  })

  it('si no se pudo volver a pedir, no se dice que el stock está confirmado', async () => {
    mockQueryFn.mockRejectedValueOnce(new Error('sin red'))
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.revalidando).toBe(false))
    expect(result.current.confirmado).toBe(false)
  })

  it('sin conexión no llega al servidor: no se dice que el stock está confirmado y se avisa que falta la señal', async () => {
    onlineManager.setOnline(false)
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.revalidando).toBe(false))
    expect(mockQueryFn).not.toHaveBeenCalled()
    expect(result.current.confirmado).toBe(false)
    expect(result.current.sinConexion).toBe(true)
  })
})
