import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { storage } from '@/core/utils/storage'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'
import { useDepositoDeVenta } from '@/features/venta-nueva/hooks/useDepositoDeVenta'
import { useStockPorDeposito } from '@/features/inventario/hooks/useStockPorDeposito'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { useClientesRecientes } from '@/libs/api-client/socios'
import { useCatalogoVenta } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { useCompraBorrador } from '@/features/compras/hooks/useCompraBorrador'
import { api } from '@/core/api/client'

// Regresión (verificador, sonda "sinCapacidad"): quien NO tiene CAP_VER_TODOS_LOS_DEPOSITOS hace exactamente los
// mismos pedidos que antes del depósito de la sesión (origin/main d80ffa1): mismos depósitos por defecto, mismas URLs
// y ningún encabezado X-Deposito-Sesion, ni siquiera vacío.
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

const SALTA = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const mockFetch = jest.fn()
const pedidos = () => mockFetch.mock.calls
  .map(([url, init]) => {
    const h = new Headers((init as RequestInit)?.headers)
    h.delete('authorization')
    const hs: Record<string, string> = {}
    h.forEach((v, k) => { hs[k] = v })
    return { linea: `${(init as RequestInit)?.method ?? 'GET'} ${String(url).replace(/^https?:\/\/[^/]+/, '')}`, headers: hs }
  })
  .sort((a, b) => a.linea.localeCompare(b.linea))

const antes = (dep: string) => [
  'GET /api/v1/Productos/catalogo-stock?PageNumber=1&PageSize=1000',
  'GET /api/v1/socios-comerciales/clientes-recientes?limite=5',
  'GET /api/v1/socios-comerciales?pageNumber=1&pageSize=20&tipo=1&activo=true&agenda=true',
  `GET /api/v1/Stocks/resumen?DepositoId=${dep}&Activo=true`,
  `GET /api/v1/Stocks?DepositoId=${dep}&Activo=true&PageNumber=1&PageSize=20`,
  'GET /api/v1/Ventas?pageSize=5',
  'POST /api/v1/Ventas',
].sort((a, b) => a.localeCompare(b))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockFetch.mockReset().mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { items: [], hasNextPage: false, totalCount: 0 } }) }))
  global.fetch = mockFetch as unknown as typeof fetch
  storage.remove('forward-deposito-sesion')
})

describe.each([
  // nombre, capacidades, depósito propio, elección guardada de OTRO usuario, depósito esperado
  ['vendedor con depósito', [], SALTA, null, SALTA],
  ['vendedor sin depósito', [], undefined, null, DEPOSITO_CENTRAL_ID],
  ['gerente de stock', ['CAP_VER_STOCK_OTROS_DEPOSITOS'], SALTA, null, SALTA],
  ['vendedor con una elección de otro guardada', [], SALTA, NORTE, SALTA],
] as const)('sin CAP_VER_TODOS_LOS_DEPOSITOS: %s', (_n, caps, propio, otro, esperado) => {
  it('los depósitos por defecto y los pedidos son los de antes, sin X-Deposito-Sesion', async () => {
    if (otro) storage.set('forward-deposito-sesion', JSON.stringify({ usuarioId: 'otro', depositoId: otro }))
    useAuthStore.setState({ user: { id: 'u1', username: 'ana', roles: [], depositoId: propio, permissions: caps.map((module) => ({ module, canRead: true })) } as never })
    expect(renderHook(() => useDepositoDeConsulta(), { wrapper: wrap() }).result.current).toBe(esperado)
    expect(renderHook(() => useDepositoDeVenta(), { wrapper: wrap() }).result.current).toBe(esperado)
    expect(renderHook(() => useCompraBorrador(), { wrapper: wrap() }).result.current.depositoId).toBe(esperado)
    renderHook(() => useStockPorDeposito({ conCantidades: true, busqueda: '' }), { wrapper: wrap() })
    renderHook(() => useCartera(''), { wrapper: wrap() })
    renderHook(() => useClientesRecientes(true), { wrapper: wrap() })
    renderHook(() => useCatalogoVenta(''), { wrapper: wrap() })
    await api.get('/api/v1/Ventas?pageSize=5')
    await api.post('/api/v1/Ventas', { a: 1 })
    await new Promise((r) => setTimeout(r, 400))
    expect(pedidos().map((p) => p.linea)).toEqual(antes(esperado))
    for (const p of pedidos()) expect(p.headers).toEqual({ 'content-type': 'application/json' })
  })
})
