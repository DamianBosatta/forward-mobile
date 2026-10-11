import { api, configureApiClient } from '@/core/api/client'
import { crearQueryClient } from '@/core/query/queryClient'
import { useAuthStore } from '../store/auth.store'
import { vaciarCacheAlCerrarSesion } from '../lib/vaciarCacheAlCerrarSesion'

jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

/** Sesión abierta con datos del usuario en la caché (el resumen de Inicio, con importes). */
function conSesion() {
  const qc = crearQueryClient()
  const soltar = vaciarCacheAlCerrarSesion(qc)
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: { cantidad: 2, importes: [] } })
  return { qc, soltar }
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('cerrar la sesión vacía la caché: el próximo usuario del teléfono no ve lo del anterior', () => {
  it('cierre forzado: el refresh rechazado (4xx) desloguea y la caché queda vacía', async () => {
    const { qc, soltar } = conSesion()
    // Como lo configuran useAuthGuard y useAuth.
    configureApiClient({
      getToken: () => useAuthStore.getState().accessToken,
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      onTokensRefreshed: (t) => useAuthStore.getState().setTokens(t),
      onUnauthorized: () => useAuthStore.getState().logout(),
    })
    responder(401, {})
    responder(400, { error: 'invalid_grant' })

    await expect(api.get('/api/v1/Inicio/resumen')).rejects.toMatchObject({ status: 401 })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
    soltar()
  })

  it('volver a autenticarse (o rehidratar la sesión al abrir la app) no la borra', () => {
    const { qc, soltar } = conSesion()
    useAuthStore.setState({ isAuthenticated: true, accessToken: 't2' })
    expect(qc.getQueryData(['inicio', 'resumen'])).toBeTruthy()
    soltar()
  })
})
