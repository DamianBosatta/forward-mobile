import { renderHook, act } from '@testing-library/react-native'
import { useComprasList } from '../../hooks/useComprasList'
import { useInfiniteCompras, useComprasResumen } from '@/libs/api-client/compras'

jest.mock('@/libs/api-client/compras', () => ({
  useInfiniteCompras: jest.fn(),
  useComprasResumen: jest.fn(),
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
            totalCount: 137,
            items: [
              { id: '1', razonSocialProveedor: 'Prov A', estado: '1', totalAmount: 100, fecha: new Date(now.getFullYear(), now.getMonth(), 10).toISOString() },
              { id: '2', razonSocialProveedor: 'Prov B', estado: '2', totalAmount: 200, fecha: new Date(now.getFullYear(), now.getMonth(), 15).toISOString() }
            ]
          }
        ]
      },
      isLoading: false
    })
    ;(useComprasResumen as jest.Mock).mockReturnValue({
      data: { totalComprado: 98765, notasPedido: 7 },
    })
  })

  it('el contador y los totales vienen del servidor, no de sumar lo cargado', () => {
    const { result } = renderHook(() => useComprasList())

    expect(result.current.contador).toBe('Mostrando 2 de 137')
    expect(result.current.totalCount).toBe(137)
    expect(result.current.pendCount).toBe(7)
  })

  it('sin resumen del servidor no muestra totales (undefined, no una suma parcial)', () => {
    ;(useComprasResumen as jest.Mock).mockReturnValue({ data: undefined })
    const { result } = renderHook(() => useComprasList())

    expect(result.current.pendCount).toBeUndefined()
  })

  it('pide al servidor el mes elegido y la búsqueda (no filtra páginas parciales)', () => {
    renderHook(() => useComprasList())
    const args = (useInfiniteCompras as jest.Mock).mock.calls[0][0]
    expect(args.fechaDesde).toMatch(/^\d{4}-\d{2}-01$/)
    expect(args.fechaHasta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la búsqueda se debouncea: tipear rápido pide una sola vez con el término final', () => {
    jest.useFakeTimers()
    try {
      const { result } = renderHook(() => useComprasList())
      const terminos = () =>
        (useInfiniteCompras as jest.Mock).mock.calls.map(c => c[0].searchTerm)

      act(() => { result.current.setSearchTerm('pr') })
      act(() => { jest.advanceTimersByTime(100) })
      act(() => { result.current.setSearchTerm('prov') })
      act(() => { jest.advanceTimersByTime(100) })
      act(() => { result.current.setSearchTerm('  prov a  ') })

      // antes de cumplirse la espera, ningún término intermedio llegó a las queries
      expect(terminos().every(t => t === undefined)).toBe(true)
      expect((useComprasResumen as jest.Mock).mock.calls.every(c => c[0].searchTerm === undefined)).toBe(true)

      act(() => { jest.advanceTimersByTime(300) })

      const ultimo = (useInfiniteCompras as jest.Mock).mock.calls.at(-1)[0]
      expect(ultimo.searchTerm).toBe('prov a')
      expect((useComprasResumen as jest.Mock).mock.calls.at(-1)[0].searchTerm).toBe('prov a')
      expect(new Set(terminos().filter(Boolean))).toEqual(new Set(['prov a']))
    } finally {
      jest.useRealTimers()
    }
  })

  it('una búsqueda de solo espacios no llega al servidor', () => {
    jest.useFakeTimers()
    try {
      const { result } = renderHook(() => useComprasList())
      act(() => { result.current.setSearchTerm('    ') })
      act(() => { jest.advanceTimersByTime(400) })
      expect((useInfiniteCompras as jest.Mock).mock.calls.at(-1)[0].searchTerm).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
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
