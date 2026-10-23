import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { useCatalogoVenta } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { useHoraDelCatalogo } from '../hooks/useHoraDelCatalogo'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn() },
  API_URL: '',
}))

const conQuery = (qc: QueryClient) => ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)
const nuevoQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('useHoraDelCatalogo: "Precios y stock de las HH:MM"', () => {
  it('sin catálogo cargado no inventa una hora', () => {
    const { result } = renderHook(() => useHoraDelCatalogo(), { wrapper: conQuery(nuevoQc()) })
    expect(result.current).toBeNull()
  })

  it('es la hora argentina en que llegó el catálogo que usa la venta (el mismo de useCatalogoVenta)', async () => {
    // 11:12 UTC = 08:12 en Argentina, sea cual sea el huso del teléfono.
    const ahora = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 22, 11, 12, 30))
    try {
      ;(api.get as jest.Mock).mockResolvedValue({ items: [], hasNextPage: false })
      const qc = nuevoQc()
      const { result } = renderHook(() => ({ hora: useHoraDelCatalogo(), catalogo: useCatalogoVenta('') }), { wrapper: conQuery(qc) })
      await waitFor(() => expect(result.current.catalogo.cargado).toBe(true))
      expect(result.current.hora).toBe('08:12')
    } finally {
      ahora.mockRestore()
    }
  })

  it('se actualiza cuando el catálogo se vuelve a cargar', async () => {
    const qc = nuevoQc()
    const { result } = renderHook(() => useHoraDelCatalogo(), { wrapper: conQuery(qc) })
    act(() => { qc.setQueryData(['productos', 'catalogoVenta', 'completo'], { items: [], truncado: false }, { updatedAt: Date.UTC(2026, 9, 22, 23, 5) }) })
    expect(result.current).toBe('20:05')
  })
})
