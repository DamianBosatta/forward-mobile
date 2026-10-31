import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useRevalidarStockVenta } from '../hooks/useRevalidarStockVenta'
import { producto } from '../__testing__/producto'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), put: jest.fn(), post: jest.fn() },
}))

/**
 * Sin `setQueryDefaults`: como en la app. Una consulta del catálogo observada sin `queryFn` hace que su refetch
 * falle con «No queryFn was passed as an option» (el toast rojo en todas las pantallas).
 */
describe('useRevalidarStockVenta: observa el catálogo con su propia queryFn', () => {
  it('con la caché vacía y sin defaults, pide el catálogo y lo confirma sin error', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGet.mockResolvedValue({ items: [producto({ id: 'p1', disponible: 9 })], hasNextPage: false })
    useCarritoVenta.setState({ lineas: [] })
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useRevalidarStockVenta(), { wrapper })
    await waitFor(() => expect(result.current.confirmado).toBe(true))
    expect(qc.getQueryState(CLAVE_CATALOGO)?.error).toBeNull()
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/v1/Productos/catalogo-stock'))
  })
})
