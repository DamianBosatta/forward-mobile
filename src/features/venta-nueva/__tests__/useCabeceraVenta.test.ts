import { renderHook } from '@testing-library/react-native'
import { useCabeceraVenta } from '../hooks/useCabeceraVenta'

const mockDias = jest.fn()
const mockFeriados = jest.fn()
jest.mock('@/libs/api-client/configuracion', () => ({
  useDiasEntrega: () => mockDias(),
  useFeriados: () => mockFeriados(),
}))

const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const consulta = (data: unknown, error: boolean) => ({ data, isSuccess: !error && data !== undefined, isError: error, refetch: jest.fn() })

describe('cabecera de la venta: calendario', () => {
  it('si falla un refetch de fondo con datos en caché, sigue proponiendo la fecha y no muestra el error', () => {
    mockDias.mockReturnValue(consulta(TODOS, true))
    mockFeriados.mockReturnValue(consulta([], true))
    const { result } = renderHook(() => useCabeceraVenta('Pedido'))
    expect(result.current.cabecera.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.calendarioError).toBe(false)
  })

  it('sin datos y con error: no propone fecha y muestra el error', () => {
    mockDias.mockReturnValue(consulta(undefined, true))
    mockFeriados.mockReturnValue(consulta([], false))
    const { result } = renderHook(() => useCabeceraVenta('Pedido'))
    expect(result.current.cabecera.fecha).toBeNull()
    expect(result.current.calendarioError).toBe(true)
  })
})
