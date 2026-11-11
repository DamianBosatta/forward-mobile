import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ENCABEZADO_DEPOSITO_SESION, elegirDepositoDeSesion, limpiarDepositoDeSesion } from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ElegirClienteVenta } from '../components/ElegirClienteVenta'

// La venta nueva busca clientes y recientes SIN el depósito de la sesión, como la web (venta-form.tsx:229, 236):
// X-Deposito-Sesion vacío. Cliente HTTP real; solo `fetch` es falso.
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

const NORTE = '22222222-2222-4222-8222-222222222222'
const mockFetch = jest.fn()
const encabezados = (parte: string) =>
  mockFetch.mock.calls.filter(([u]) => String(u).includes(parte)).map(([, init]) => new Headers((init as RequestInit).headers).get(ENCABEZADO_DEPOSITO_SESION))

beforeEach(() => {
  mockFetch.mockReset().mockImplementation((url: string) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(String(url).includes('clientes-recientes') || String(url).includes('localidades') ? [] : { items: [], page: 1, hasNextPage: false, totalCount: 0 }),
  }))
  global.fetch = mockFetch as unknown as typeof fetch
  useAuthStore.setState({
    user: { id: 'u1', roles: [], permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }, { module: 'MOD_CLIENTES', canRead: true }] } as never,
  })
  elegirDepositoDeSesion('u1', NORTE)
})
afterEach(() => limpiarDepositoDeSesion())

it('desde la venta nueva, la búsqueda de clientes y los recientes van con X-Deposito-Sesion vacío', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ElegirClienteVenta onElegir={jest.fn()} onNuevoCliente={jest.fn()} /></QueryClientProvider>)
  await waitFor(() => {
    expect(encabezados('/socios-comerciales?').length).toBeGreaterThan(0)
    expect(encabezados('clientes-recientes').length).toBeGreaterThan(0)
  })
  expect([...new Set(encabezados('/socios-comerciales?'))]).toEqual([''])
  expect([...new Set(encabezados('clientes-recientes'))]).toEqual([''])
})
