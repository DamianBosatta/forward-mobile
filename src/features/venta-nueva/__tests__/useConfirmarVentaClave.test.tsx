import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { leerCola, quitarDeCola } from '@/features/venta-sin-senal/lib/cola'
import { producto } from '../__testing__/producto'

const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), put: (...a: unknown[]) => mockPut(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

const { ApiError } = jest.requireActual('@/core/api/client')
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const borrador = { borrador: null, cerrar: jest.fn(), descartar: jest.fn(), flush: jest.fn() }
const lineas = [{ productoId: 'p1', producto: producto({ disponible: 99 }), cantidad: 2, descuentoPct: 0 }]

const hook = (edicion?: { ventaId: string; version: number }) => renderHook(() => useConfirmarVenta({
  clienteId: 'c1', esPedido: true, edicion, lineas, descuentoGeneral: 0,
  cabecera: { metodoEntrega: 1 as never, fecha: '2026-10-30', flete: 0, observaciones: '' },
  borrador: borrador as never, alGuardar: jest.fn(),
}), { wrapper })
// Sin la capacidad también se pregunta `/Stocks/disponibilidad`: acá solo cuentan los altas.
const altas = () => mockPost.mock.calls.filter((c) => c[0] === '/api/v1/Ventas')
const claveDe = (n: number) => (altas()[n][1] as { claveIdempotencia: string }).claveIdempotencia

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
  mockPost.mockImplementation(async (url: string) => (url === '/api/v1/Stocks/disponibilidad' ? [] : { ventaId: 'v1', message: 'ok', estado: 1 }))
})

describe('useConfirmarVenta: clave de idempotencia por borrador', () => {
  it('después de confirmar con éxito, la venta siguiente usa una clave nueva', async () => {
    const { result } = hook()
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    expect(altas()).toHaveLength(2)
    expect(claveDe(1)).not.toBe(claveDe(0))
  })

  it('reintentar el mismo borrador que no se confirmó reusa la misma clave', async () => {
    mockPost.mockImplementationOnce(async () => []).mockRejectedValueOnce(new ApiError(400, 'Dato inválido'))
    const { result } = hook()
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    expect(altas()).toHaveLength(2)
    expect(claveDe(1)).toBe(claveDe(0))
  })
})

describe('useConfirmarVenta: alta cortada por plazo (RED-07)', () => {
  beforeEach(() => { for (const v of leerCola('u')) quitarDeCola('u', v.clave) })

  it('a timed-out alta is queued with the same key that was posted, so it cannot become a second sale', async () => {
    const tiempoAgotado = Object.assign(new Error('Aborted'), { name: 'AbortError' })
    mockPost.mockImplementation(async (url: string) => {
      if (url === '/api/v1/Stocks/disponibilidad') return []
      throw tiempoAgotado
    })
    const { result } = hook()
    await act(async () => { await result.current.confirmar() })
    expect(altas()).toHaveLength(1)
    const cola = leerCola('u')
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ clave: claveDe(0), alta: { claveIdempotencia: claveDe(0) } })
  })
})

describe('useConfirmarVenta: editar una venta existente manda su clave', () => {
  const guardados = () => mockPut.mock.calls.filter((c) => c[0] === '/api/v1/Ventas/v9')
  const claveGuardado = (n: number) => (guardados()[n][1] as { claveIdempotencia: string }).claveIdempotencia

  beforeEach(() => { mockPut.mockResolvedValue({ ventaId: 'v9', message: 'ok', estado: 1 }) })

  it('lleva claveIdempotencia sin perder el resto del cuerpo', async () => {
    const { result } = hook({ ventaId: 'v9', version: 4 })
    await act(async () => { await result.current.confirmar() })
    expect(guardados()).toHaveLength(1)
    expect(guardados()[0][1]).toMatchObject({ id: 'v9', version: 4, claveIdempotencia: expect.stringMatching(/^mobile-/) })
  })

  it('el reintento tras un corte repite la clave; después de guardar, otra edición usa otra', async () => {
    mockPut.mockRejectedValueOnce(new ApiError(500, 'Error'))
    const { result } = hook({ ventaId: 'v9', version: 4 })
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar() })
    expect(guardados()).toHaveLength(3)
    expect(claveGuardado(1)).toBe(claveGuardado(0))
    expect(claveGuardado(2)).not.toBe(claveGuardado(0))
  })
})
