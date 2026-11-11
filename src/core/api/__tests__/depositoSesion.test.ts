import { api, configureApiClient } from '@/core/api/client'
import {
  ENCABEZADO_DEPOSITO_SESION,
  SIN_DEPOSITO_DE_SESION,
  elegirDepositoDeSesion,
  limpiarDepositoDeSesion,
} from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'

// El encabezado X-Deposito-Sesion, con las reglas de la web (forward-frontend packages/api-client/src/tests/deposito-sesion.test.ts).
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))
jest.mock('@/src/core/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const NORTE = '22222222-2222-4222-8222-222222222222'
const mockFetch = jest.fn()
const ok = () => mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: [] }) })
const encabezado = (i = 0) => new Headers((mockFetch.mock.calls[i][1] as RequestInit).headers).get(ENCABEZADO_DEPOSITO_SESION)
const conSesion = (id: string | null) => useAuthStore.setState({ user: id ? ({ id, roles: [], permissions: [] } as never) : null })

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  limpiarDepositoDeSesion()
  conSesion('u1')
})

describe('X-Deposito-Sesion en cada pedido (S8, G2)', () => {
  it('con un depósito elegido lo manda', async () => {
    elegirDepositoDeSesion('u1', NORTE)
    ok()
    await api.get('/api/v1/Ventas')
    expect(encabezado()).toBe(NORTE)
  })

  it('sin elección o con "Todos" no lo manda', async () => {
    ok()
    await api.get('/api/v1/Ventas')
    expect(encabezado()).toBeNull()
    elegirDepositoDeSesion('u1', NORTE)
    elegirDepositoDeSesion('u1', null)
    ok()
    await api.get('/api/v1/Ventas')
    expect(encabezado(1)).toBeNull()
  })

  it('un valor que no es un id de depósito no se guarda ni viaja', async () => {
    elegirDepositoDeSesion('u1', 'todos')
    ok()
    await api.post('/api/v1/Ventas', {})
    expect(encabezado()).toBeNull()
  })

  it('no manda la elección de otro usuario ni la manda sin sesión (antes del login)', async () => {
    elegirDepositoDeSesion('u1', NORTE)
    conSesion('u2')
    ok()
    await api.get('/api/v1/Ventas')
    expect(encabezado()).toBeNull()
    conSesion(null)
    ok()
    await api.get('/api/v1/Ventas')
    expect(encabezado(1)).toBeNull()
  })

  it('SIN_DEPOSITO_DE_SESION manda el encabezado vacío aunque haya un depósito elegido', async () => {
    elegirDepositoDeSesion('u1', NORTE)
    ok()
    await api.get('/api/v1/socios-comerciales', SIN_DEPOSITO_DE_SESION)
    expect(encabezado()).toBe('')
  })

  it('el refresco del token (/connect/token) no lo lleva; el reintento tras el 401 sí', async () => {
    elegirDepositoDeSesion('u1', NORTE)
    let token = 'viejo'
    configureApiClient({ getToken: () => token, getRefreshToken: () => 'r1', onTokensRefreshed: (t) => { token = t.accessToken }, onUnauthorized: jest.fn() })
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'nuevo', refresh_token: 'r2' }) })
    ok()
    await api.get('/api/v1/Ventas')
    const urls = mockFetch.mock.calls.map(([u]) => String(u))
    const refresco = urls.findIndex((u) => u.endsWith('/connect/token'))
    expect(refresco).toBe(1)
    expect(encabezado(0)).toBe(NORTE)
    expect(encabezado(1)).toBeNull()
    expect(encabezado(2)).toBe(NORTE)
  })
})
