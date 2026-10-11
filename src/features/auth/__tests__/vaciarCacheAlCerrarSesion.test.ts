import { api, configureApiClient } from '@/core/api/client'
import { crearQueryClient } from '@/core/query/queryClient'
import { mmkvPersister } from '@/core/query/persistConfig'
import { useAuthStore } from '../store/auth.store'
import { vaciarCacheAlCerrarSesion } from '../lib/vaciarCacheAlCerrarSesion'

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

/** Sesión abierta con datos del usuario en la caché y guardados en el teléfono (el resumen de Inicio). */
async function conSesion() {
  const qc = crearQueryClient()
  const soltar = vaciarCacheAlCerrarSesion(qc, mmkvPersister)
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: { cantidad: 2, importes: [] } })
  await mmkvPersister.persistClient({ timestamp: Date.now(), buster: '', clientState: { queries: [], mutations: [] } })
  return { qc, soltar }
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('cerrar la sesión vacía la caché: el próximo usuario del teléfono no ve lo del anterior', () => {
  it('cierre forzado: el refresh rechazado (4xx) desloguea y la caché queda vacía, también en el teléfono', async () => {
    const { qc, soltar } = await conSesion()
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
    // Sin esperar al guardado periódico: si la app muere enseguida, el disco ya quedó vacío.
    expect(await mmkvPersister.restoreClient()).toBeUndefined()
    soltar()
  })

  it('volver a autenticarse (o rehidratar la sesión al abrir la app) no la borra', async () => {
    const { qc, soltar } = await conSesion()
    useAuthStore.setState({ isAuthenticated: true, accessToken: 't2' })
    expect(qc.getQueryData(['inicio', 'resumen'])).toBeTruthy()
    expect(await mmkvPersister.restoreClient()).toBeTruthy()
    soltar()
  })
})
