import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCompraForm } from '../useCompraForm'

// Mock useAuthStore and useLocalSearchParams
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: undefined }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('../../api/queries', () => ({
  useCompra: () => ({ data: undefined, isLoading: false }),
  useCreateCompra: () => ({ mutateAsync: jest.fn() }),
  useUpdateCompra: () => ({ mutateAsync: jest.fn() }),
  useConfirmarCompra: () => ({ mutateAsync: jest.fn() }),
  useRecibirCompra: () => ({ mutateAsync: jest.fn() }),
  comprasKeys: { all: ['compras'] },
}))

jest.mock('@/libs/api-client', () => ({
  useProductos: () => ({ data: { items: [] }, isLoading: false }),
  useProveedores: () => ({ data: { items: [] } }),
  useDepositos: () => ({ data: [] }),
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('useCompraForm', () => {
  it('calculates totals correctly when adding an item', () => {
    const { result } = renderHook(() => useCompraForm(), { wrapper })

    act(() => {
      // Modificamos datos cabecera
      result.current.setProveedorSelected({ id: 'prov-1', razonSocial: 'Proveedor 1' } as any)
      result.current.setDepositoSelected({ id: 'dep-1', nombre: 'Deposito 1' } as any)
    })

    act(() => {
      // Agregamos un item de costo unitario 50, cantidad 2 -> $100
      result.current.setDetalles([
        {
          productoId: 'prod-1',
          nombre: 'Test Product',
          costoUnitario: 50,
          cantidad: 2,
        }
      ])
    })

    // Subtotal (bruto) = 2 * 50 = 100
    expect(result.current.subtotal).toBe(100)
    expect(result.current.total).toBe(100)

    act(() => {
      // Agregamos descuento del 10%
      result.current.setDescuentoStr('10')
    })

    // Subtotal = 100 * (1 - 0.1) = 90
    expect(result.current.subtotal).toBe(90)
    expect(result.current.total).toBe(90)

    act(() => {
      // Agregamos gastos operativos = 5
      result.current.setGastosStr('5')
    })

    // Total = 90 + 5 = 95
    expect(result.current.total).toBe(95)
  })
})
