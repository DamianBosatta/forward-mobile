import React from 'react'
import { renderHook as renderizar } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCabeceraVenta } from '../hooks/useCabeceraVenta'

const mockDias = jest.fn()
const mockFeriados = jest.fn()
jest.mock('@/libs/api-client/configuracion', () => ({
  useDiasEntrega: () => mockDias(),
  useFeriados: () => mockFeriados(),
}))

// El hook ahora también trae el default de "Con factura" (useQuery): necesita el proveedor.
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn().mockResolvedValue({ ventaConFacturaPorDefecto: true }) } }))
const renderHook = <T,>(f: () => T) => renderizar(f, {
  wrapper: ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children),
})

const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const consulta = (data: unknown, error: boolean) => ({ data, isSuccess: !error && data !== undefined, isError: error, refetch: jest.fn() })

describe('cabecera de la venta: calendario', () => {
  afterEach(() => jest.restoreAllMocks())

  it('propone lo mismo que el servidor: el primer día con entregas desde mañana, en hora de Argentina', () => {
    // Viernes 16 de octubre de 2026 a las 23:30 en Argentina (02:30Z del sábado), sin sábado ni domingo.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-17T02:30:00Z'))
    mockDias.mockReturnValue(consulta({ ...TODOS, sabado: false, domingo: false }, false))
    mockFeriados.mockReturnValue(consulta([], false))
    const { result } = renderHook(() => useCabeceraVenta('Pedido'))
    expect(result.current.cabecera.fecha).toBe('2026-10-19')
  })

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
