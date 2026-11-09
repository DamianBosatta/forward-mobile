import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), put: jest.fn(), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

const CAP = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const borrador = { borrador: null, cerrar: jest.fn(), descartar: jest.fn(), flush: jest.fn() }

function hook(lineas: LineaCarrito[]) {
  return renderHook(() => useConfirmarVenta({
    clienteId: 'c1', esPedido: true, lineas, descuentoGeneral: 0,
    cabecera: { metodoEntrega: 1 as never, fecha: '2026-10-30', flete: 0, observaciones: '' },
    borrador: borrador as never, alGuardar: jest.fn(),
  }), { wrapper })
}
const linea = (over: Parameters<typeof producto>[0], cantidad = 5): LineaCarrito => ({ productoId: 'p1', producto: producto(over), cantidad, descuentoPct: 0 })

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockPost.mockResolvedValue({ ventaId: 'v1', message: 'ok', estado: 1 })
})

describe('useConfirmarVenta: falta stock (el servidor lo deja por autorizar, sin motivo obligatorio)', () => {
  it.each([
    ['quien no ve cantidades y el producto no puede venderse', [], { disponible: 0, puedeVenderse: false }],
    ['quien ve cantidades y pide más que el disponible', [CAP], { disponible: 3, puedeVenderse: true }],
  ])('%s: manda el pedido directo, sin motivo y sin consultar disponibilidad', async (_t, permissions, over) => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions } as never })
    const { result } = hook([linea(over)])
    await act(async () => { await result.current.confirmar() })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.not.objectContaining({ motivoVentaSinStock: expect.anything() }))
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', expect.anything())
    expect(result.current.error).toBeNull()
    expect(mockReplace).toHaveBeenCalled()
  })

  it('el mostrador sin stock sigue rechazado: se ve el mensaje del servidor y no se navega', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
    const { ApiError } = jest.requireActual('@/core/api/client')
    mockPost.mockRejectedValue(new ApiError(400, 'El retiro en local no tiene stock suficiente.', undefined, 'VentaMostradorSinStock'))
    const { result } = hook([linea({ disponible: 3 })])
    await act(async () => { await result.current.confirmar() })
    expect(result.current.error).toContain('El retiro en local no tiene stock suficiente.')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
