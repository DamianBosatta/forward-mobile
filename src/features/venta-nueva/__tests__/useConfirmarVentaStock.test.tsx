import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
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

describe('useConfirmarVenta: falta stock (S6, S7)', () => {
  it('quien no ve cantidades y puedeVenderse true: confirma sin pedir motivo aunque disponible llegue en 0', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    const { result } = hook([linea({ disponible: 0, puedeVenderse: true })])
    await act(async () => { await result.current.confirmar() })
    expect(result.current.pedirMotivo).toBe(false)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.not.objectContaining({ motivoVentaSinStock: expect.anything() }))
  })

  it('quien no ve cantidades y puedeVenderse false: pide el motivo antes de mandar', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    const { result } = hook([linea({ disponible: 0, puedeVenderse: false })])
    await act(async () => { await result.current.confirmar() })
    expect(result.current.pedirMotivo).toBe(true)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('quien ve cantidades compara contra disponible: pide motivo aunque puedeVenderse diga true', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
    const { result } = hook([linea({ disponible: 3, puedeVenderse: true })])
    await act(async () => { await result.current.confirmar() })
    expect(result.current.pedirMotivo).toBe(true)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('con el motivo la venta sin stock se manda (va a autorización): no se bloquea', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
    const { result } = hook([linea({ disponible: 3 })])
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.confirmar('Repone el lunes') })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.objectContaining({ motivoVentaSinStock: 'Repone el lunes' }))
    expect(mockReplace).toHaveBeenCalled()
  })

  it('decide con el stock del catálogo al momento de confirmar, no con el de cuando se renderizó', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
    const { result } = hook([linea({ disponible: 9 })])
    // Después de revalidar, el catálogo dice que quedan 3 de los 5 pedidos.
    qc.setQueryData(CLAVE_CATALOGO, { items: [producto({ id: 'p1', disponible: 3 })], truncado: false })
    await act(async () => { await result.current.confirmar() })
    expect(result.current.pedirMotivo).toBe(true)
    expect(mockPost).not.toHaveBeenCalled()
  })
})
