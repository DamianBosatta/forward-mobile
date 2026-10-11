import { persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import { api, configureApiClient } from '@/core/api/client'
import { crearQueryClient, opcionesDePersistencia } from '@/core/query/queryClient'
import { mmkvPersister } from '@/core/query/persistConfig'
import { useAuthStore } from '../store/auth.store'
import { vaciarCacheAlCerrarSesion } from '../lib/vaciarCacheAlCerrarSesion'

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

/**
 * Sesión abierta con el resumen de Inicio en la caché, guardado en el teléfono por la misma
 * suscripción que usa PersistQueryClientProvider, con el persister de la app (MMKV).
 */
async function conSesion() {
  const qc = crearQueryClient()
  const dejarDeGuardar = persistQueryClientSubscribe({ queryClient: qc, persister: mmkvPersister, dehydrateOptions: opcionesDePersistencia })
  const dejarDeEscuchar = vaciarCacheAlCerrarSesion(qc, mmkvPersister)
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: { cantidad: 2, importes: [] } })
  expect((await mmkvPersister.restoreClient())?.clientState.queries).toHaveLength(1)
  return { qc, soltar: () => { dejarDeGuardar(); dejarDeEscuchar() } }
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
    // El disco queda sin nada (no un cliente vacío) aunque la app muera enseguida.
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
