import { renderHook } from '@testing-library/react-native'
import { useVentasList } from '../useVentasList'
import { useInfiniteVentas, useVentasResumen } from '@/libs/api-client/ventas'

jest.mock('@/libs/api-client/ventas', () => ({ useInfiniteVentas: jest.fn(), useVentasResumen: jest.fn() }))
jest.mock('@/libs/theme', () => ({ useColors: () => ({ primary: '#000' }) }))

// El servidor toma el día de fechaDesde/fechaHasta y aplica inicio/fin de día de Argentina (D-021).
describe('useVentasList — mes por días calendario argentinos', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(useInfiniteVentas as jest.Mock).mockReturnValue({ data: { pages: [] }, isLoading: false })
    ;(useVentasResumen as jest.Mock).mockReturnValue({ data: undefined, refetch: jest.fn() })
  })
  afterEach(() => jest.useRealTimers())
  const ultimaLista = () => (useInfiniteVentas as jest.Mock).mock.calls.at(-1)[0]

  it('el mes por defecto va del primer al último día, sin pisar el mes siguiente', () => {
    jest.setSystemTime(new Date('2026-10-15T15:00:00Z'))
    renderHook(() => useVentasList())
    expect(ultimaLista().fechaDesde).toBe('2026-10-01')
    expect(ultimaLista().fechaHasta).toBe('2026-10-31')
  })

  it('22:30 del 31-10 en Argentina (01:30Z del 1-11) todavía es octubre', () => {
    jest.setSystemTime(new Date('2026-11-01T01:30:00Z'))
    const { result } = renderHook(() => useVentasList())
    expect(ultimaLista().fechaDesde).toBe('2026-10-01')
    expect(ultimaLista().fechaHasta).toBe('2026-10-31')
    expect(result.current.isCurrentMonth).toBe(true)
  })

  it('00:30 del 1-11 en Argentina (03:30Z) ya es noviembre', () => {
    jest.setSystemTime(new Date('2026-11-01T03:30:00Z'))
    renderHook(() => useVentasList())
    expect(ultimaLista().fechaDesde).toBe('2026-11-01')
    expect(ultimaLista().fechaHasta).toBe('2026-11-30')
  })
})
