import { renderHook, act } from '@testing-library/react-native'
import { useComprasList } from '../../hooks/useComprasList'
import { useBorradoresCompraMios, useInfiniteCompras, useComprasResumen } from '@/libs/api-client/compras'

jest.mock('@/libs/api-client/compras', () => ({
  useInfiniteCompras: jest.fn(),
  useComprasResumen: jest.fn(),
  useBorradoresCompraMios: jest.fn(),
}))

describe('useComprasList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useInfiniteCompras as jest.Mock).mockReturnValue({
      data: { pages: [{ totalCount: 137, items: [{ id: '1' }, { id: '2' }] }] },
      isLoading: false,
    })
    ;(useComprasResumen as jest.Mock).mockReturnValue({
      data: { totalComprado: 98765, notasPedido: 7, confirmadas: 2, entregadas: 30 },
    })
    ;(useBorradoresCompraMios as jest.Mock).mockReturnValue({ data: undefined })
  })

  it('el contador y el resumen vienen del servidor, no de sumar lo cargado', () => {
    const { result } = renderHook(() => useComprasList())

    expect(result.current.contador).toBe('Mostrando 2 de 137')
    expect(result.current.resumenTexto).toBe('7 notas de pedido · 2 por recibir')
  })

  it('sin resumen del servidor no muestra números (null, no una suma parcial)', () => {
    ;(useComprasResumen as jest.Mock).mockReturnValue({ data: undefined })
    const { result } = renderHook(() => useComprasList())

    expect(result.current.resumenTexto).toBeNull()
  })

  it('en Borradores no pide la lista de compras', () => {
    const { result } = renderHook(() => useComprasList())
    act(() => { result.current.setPestana('borradores') })

    expect((useInfiniteCompras as jest.Mock).mock.calls.at(-1)[1]).toEqual({ enabled: false })
    expect(useBorradoresCompraMios).toHaveBeenLastCalledWith(true)
  })

  it('la búsqueda se debouncea: tipear rápido pide una sola vez con el término final', () => {
    jest.useFakeTimers()
    try {
      const { result } = renderHook(() => useComprasList())
      const terminos = () =>
        (useInfiniteCompras as jest.Mock).mock.calls.map(c => c[0].searchTerm)

      act(() => { result.current.setBusqueda('pr') })
      act(() => { jest.advanceTimersByTime(100) })
      act(() => { result.current.setBusqueda('prov') })
      act(() => { jest.advanceTimersByTime(100) })
      act(() => { result.current.setBusqueda('  prov a  ') })

      // antes de cumplirse la espera, ningún término intermedio llegó a las queries
      expect(terminos().every(t => t === undefined)).toBe(true)
      expect((useComprasResumen as jest.Mock).mock.calls.every(c => c[0].searchTerm === undefined)).toBe(true)

      act(() => { jest.advanceTimersByTime(300) })

      expect((useInfiniteCompras as jest.Mock).mock.calls.at(-1)[0].searchTerm).toBe('prov a')
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
      act(() => { result.current.setBusqueda('    ') })
      act(() => { jest.advanceTimersByTime(400) })
      expect((useInfiniteCompras as jest.Mock).mock.calls.at(-1)[0].searchTerm).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })
})
