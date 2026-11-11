import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { ENCABEZADO_DEPOSITO_SESION, elegirDepositoDeSesion, limpiarDepositoDeSesion } from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useClientesRecientes } from '@/libs/api-client/socios'
import { useCatalogoVenta } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { useCartera } from '../hooks/useCartera'

// Como la web (venta-form.tsx, GrillaLineasVenta.tsx): la venta nueva busca clientes, recientes y catálogo SIN el
// depósito de la sesión (X-Deposito-Sesion vacío); el resto de las pantallas lo siguen mandando. Cliente HTTP real.
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

const NORTE = '22222222-2222-4222-8222-222222222222'
const mockFetch = jest.fn()
const encabezados = (parte: string) =>
  mockFetch.mock.calls.filter(([u]) => String(u).includes(parte)).map(([, init]) => new Headers((init as RequestInit).headers).get(ENCABEZADO_DEPOSITO_SESION))

let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockFetch.mockReset().mockImplementation(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve({ items: [], page: 1, hasNextPage: false, totalCount: 0 }),
  }))
  global.fetch = mockFetch as unknown as typeof fetch
  useAuthStore.setState({ user: { id: 'u1', roles: [], permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] } as never })
  elegirDepositoDeSesion('u1', NORTE)
})
afterEach(() => limpiarDepositoDeSesion())

describe('búsquedas de la venta nueva sin el depósito de la sesión (S8)', () => {
  it('la cartera de la venta nueva manda el encabezado vacío; la de Clientes manda el elegido, con otra clave de caché', async () => {
    renderHook(() => useCartera('ana', undefined, undefined, { sinDepositoDeSesion: true }), { wrapper })
    await waitFor(() => expect(encabezados('/socios-comerciales?')).toEqual(['']))
    renderHook(() => useCartera('ana', undefined, { ordenarPor: 'Direccion' }), { wrapper })
    renderHook(() => useCartera('ana'), { wrapper })
    await waitFor(() => expect(encabezados('/socios-comerciales?')).toEqual(['', NORTE, NORTE]))
  })

  it('los recientes de la venta nueva van sin depósito; los de Inicio y Clientes, con el elegido, y no comparten caché', async () => {
    renderHook(() => useClientesRecientes(true, { sinDepositoDeSesion: true }), { wrapper })
    await waitFor(() => expect(encabezados('clientes-recientes')).toEqual(['']))
    renderHook(() => useClientesRecientes(true), { wrapper })
    await waitFor(() => expect(encabezados('clientes-recientes')).toEqual(['', NORTE]))
  })

  it('el catálogo de la venta (completo y búsqueda en el servidor) va sin depósito de sesión', async () => {
    mockFetch.mockImplementation((url: string) => Promise.resolve(url.includes('SearchTerm')
      ? { ok: true, status: 200, json: () => Promise.resolve({ items: [], hasNextPage: false }) }
      : { ok: false, status: 500, json: () => Promise.resolve({}) }))
    renderHook(() => useCatalogoVenta('jabón'), { wrapper })
    await waitFor(() => expect(encabezados('SearchTerm=').length).toBeGreaterThan(0), { timeout: 3000 })
    expect([...new Set(encabezados('catalogo-stock'))]).toEqual([''])
  })
})
