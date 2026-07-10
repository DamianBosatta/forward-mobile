import { renderHook, act } from '@testing-library/react-native'
import { useComprasList } from '../../hooks/useComprasList'
import { useInfiniteCompras } from '@/libs/api-client/compras'

jest.mock('@/libs/api-client/compras', () => ({
  useInfiniteCompras: jest.fn()
}))

jest.mock('@/libs/theme', () => ({
  useColors: () => ({ primary: '#000' })
}))

jest.mock('@/core/constants/status_compras', () => ({
  getCompraStatusConfig: (estado: string) => {
    if (estado === '1') return { label: 'Pendiente' }
    if (estado === '2') return { label: 'Confirmado' }
    return { label: 'Entregado' }
  }
}))

describe('useComprasList', () => {
  const now = new Date()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useInfiniteCompras as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            items: [
              { id: '1', razonSocialProveedor: 'Prov A', estado: '1', totalAmount: 100, fecha: new Date(now.getFullYear(), now.getMonth(), 10).toISOString() },
              { id: '2', razonSocialProveedor: 'Prov B', estado: '2', totalAmount: 200, fecha: new Date(now.getFullYear(), now.getMonth(), 15).toISOString() }
            ]
          }
        ]
      },
      isLoading: false
    })
  })

  it('debe filtrar compras por mes y calcular totales', () => {
    const { result } = renderHook(() => useComprasList())

    expect(result.current.comprasByMonth.length).toBe(2)
    expect(result.current.totalMonto).toBe(300)
    expect(result.current.pendCount).toBe(1)
  })

  it('debe filtrar por termino de busqueda', () => {
    const { result } = renderHook(() => useComprasList())

    act(() => {
      result.current.setSearchTerm('prov a')
    })

    expect(result.current.filteredCompras.length).toBe(1)
    expect(result.current.filteredCompras[0].id).toBe('1')
  })

  it('debe filtrar por estado', () => {
    const { result } = renderHook(() => useComprasList())

    act(() => {
      result.current.setFilter('Confirmado')
    })

    expect(result.current.filteredCompras.length).toBe(1)
    expect(result.current.filteredCompras[0].id).toBe('2')
  })
})
