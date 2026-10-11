import { renderHook } from '@testing-library/react-native'
import { useVentasList } from '../hooks/useVentasList'
import { useInfiniteVentas } from '@/libs/api-client/ventas'

jest.mock('@/libs/api-client/ventas', () => ({ useInfiniteVentas: jest.fn() }))
jest.mock('@/libs/theme', () => ({ useColors: () => ({ primary: '#000' }) }))

const pagina = (desde: number, n: number, totalCount: number) => ({
  items: Array.from({ length: n }, (_, i) => ({ id: String(desde + i), estado: '1', totalAmount: 1000 })),
  totalCount,
})

describe('useVentasList — contador y totales del servidor', () => {
  beforeEach(() => {
    ;(useInfiniteVentas as jest.Mock).mockReturnValue({
      data: { pages: [pagina(0, 20, 137), pagina(20, 20, 137)] },
      isLoading: false,
    })
  })

  it('con 2 páginas de 20 y totalCount 137 el contador dice "Mostrando 40 de 137"', () => {
    const { result } = renderHook(() => useVentasList())
    expect(result.current.contador).toBe('Mostrando 40 de 137')
    expect(result.current.totalCount).toBe(137)
  })

  it('no expone totales de importe ni pendientes sumados sobre las páginas cargadas', () => {
    const { result } = renderHook(() => useVentasList())
    expect(result.current).not.toHaveProperty('totalMonto')
    expect(result.current).not.toHaveProperty('pendCount')
  })
})
