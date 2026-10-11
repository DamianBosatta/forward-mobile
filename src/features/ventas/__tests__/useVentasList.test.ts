import { act, renderHook } from '@testing-library/react-native'
import { useVentasList } from '../hooks/useVentasList'
import { useInfiniteVentas, useVentasResumen } from '@/libs/api-client/ventas'

jest.mock('@/libs/api-client/ventas', () => ({ useInfiniteVentas: jest.fn(), useVentasResumen: jest.fn() }))
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
    ;(useVentasResumen as jest.Mock).mockReturnValue({ data: undefined, refetch: jest.fn() })
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

describe('useVentasList — filtro de estado en el servidor (forward-system #873)', () => {
  const ultimaLista = () => (useInfiniteVentas as jest.Mock).mock.calls.at(-1)[0]
  const ultimoResumen = () => (useVentasResumen as jest.Mock).mock.calls.at(-1)[0]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useInfiniteVentas as jest.Mock).mockReturnValue({
      data: { pages: [pagina(0, 20, 137), pagina(20, 20, 137)] },
      isLoading: false,
    })
  })

  it('el chip va al servidor con `estados` (Preparando = EnPreparacion y Empacada) y el resumen pide lo mismo que la lista', () => {
    ;(useVentasResumen as jest.Mock).mockReturnValue({ data: undefined, refetch: jest.fn() })
    const { result } = renderHook(() => useVentasList())
    expect(result.current.ordenes).toBe(137)
    act(() => { result.current.setFilter('Preparando') })

    expect(ultimaLista().estados).toEqual(['EnPreparacion', 'Empacada'])
    const { pageSize: _pagina, ...filtroLista } = ultimaLista()
    expect(ultimoResumen()).toEqual(filtroLista)
    // Sin resumen todavía no se sabe si el servidor filtró: la tarjeta ÓRDENES no muestra un número.
    expect(result.current.ordenes).toBeUndefined()
  })

  it('servidor nuevo: con un estado elegido el contador sigue, M de la lista e importe del resumen', () => {
    // `cantidad` es igual al totalCount de la lista en el servidor; acá es otro número para ver de dónde sale M.
    ;(useVentasResumen as jest.Mock).mockReturnValue({
      data: { totalVendido: 40000, pendientes: 40, porAutorizar: 0, entregadas: 0, cantidad: 39 },
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useVentasList())
    expect(result.current.contador).toBe('Mostrando 40 de 137 · $\u00A040.000,00')
    expect(result.current.ordenes).toBe(137)
    expect(result.current.ordenesConFiltro).toBe(false)
    act(() => { result.current.setFilter('Pendiente') })
    expect(result.current.contador).toBe('Mostrando 40 de 137 · $\u00A040.000,00')
    expect(result.current.ordenesConFiltro).toBe(true)
    act(() => { result.current.setTipoOperacion(1) })
    // Presupuestos: el resumen no da su importe (solo suma pedidos).
    expect(result.current.contador).toBe('Mostrando 40 de 137')
  })

  it('servidor viejo (resumen sin cantidad): se le pide `estados`, pero filtra el teléfono y el contador se oculta, sin importe', () => {
    ;(useVentasResumen as jest.Mock).mockReturnValue({
      data: { totalVendido: 999999, pendientes: 3, porAutorizar: 0, entregadas: 2 },
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useVentasList())
    expect(result.current.contador).toBe('Mostrando 40 de 137')
    act(() => { result.current.setFilter('Entregada') })

    expect(ultimaLista().estados).toEqual(['Entregada'])
    expect(result.current.filteredVentas).toHaveLength(0)
    expect(result.current.contador).toBeNull()
    // Ese servidor ignora `estados`: ÓRDENES es la del mes, sin la etiqueta del filtro.
    expect(result.current.ordenes).toBe(137)
    expect(result.current.ordenesConFiltro).toBe(false)
  })
})
