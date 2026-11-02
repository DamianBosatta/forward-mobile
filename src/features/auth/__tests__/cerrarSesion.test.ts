/**
 * Audit tranche 1, S1 (A-01 + M-02): one `cerrarSesion()` for every logout path. After it, nothing of the
 * previous session stays on the phone: tokens, the react-query cache (memory and disk, mutations included),
 * the active trip of the driver console (`forward-logistica-store`) and the fingerprint credential.
 */
const mockSecure = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  getItem: (k: string) => mockSecure.get(k) ?? null,
  setItem: (k: string, v: string) => { mockSecure.set(k, v) },
  getItemAsync: async (k: string) => mockSecure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockSecure.set(k, v) },
  deleteItemAsync: async (k: string) => { mockSecure.delete(k) },
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import { api, configureApiClient } from '@/core/api/client'
import { crearQueryClient, opcionesDePersistencia } from '@/core/query/queryClient'
import { mmkvPersister } from '@/core/query/persistConfig'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { useAuthStore } from '../store/auth.store'
import { useOfertaDeHuella } from '../store/ofertaDeHuella.store'
import { cerrarSesion, conectarCierreDeSesion } from '../lib/cerrarSesion'

const CREDENCIAL_HUELLA = 'forward_biometric_credentials'
const DECISION_HUELLA = 'forward_biometric_enabled'
const VIAJE = { id: 'hoja-1', detalles: [{ id: 'p1', clienteNombre: 'Almacén Don Pepe', direccion: 'Mitre 123' }] }

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

/**
 * Open session with data in every store: the Inicio summary in the cache (saved on the phone by the same
 * subscription PersistQueryClientProvider uses, with the app persister), a pending mutation, an active trip
 * and a saved fingerprint credential. The logout wiring is connected as `app/_layout.tsx` does.
 */
async function conSesion() {
  const qc = crearQueryClient()
  const dejarDeGuardar = persistQueryClientSubscribe({ queryClient: qc, persister: mmkvPersister, dehydrateOptions: opcionesDePersistencia })
  const desconectar = conectarCierreDeSesion(qc, mmkvPersister)
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: { cantidad: 2, importes: [] } })
  qc.getMutationCache().build(qc, { mutationKey: ['cobro'] })
  useLogisticaStore.getState().setActiveTrip(VIAJE as never)
  mockSecure.set(CREDENCIAL_HUELLA, JSON.stringify({ username: 'chofer', password: 'secreta' }))
  mockSecure.set(DECISION_HUELLA, 'true')
  useOfertaDeHuella.getState().ofrecer({ username: 'chofer', password: 'secreta' })
  expect((await mmkvPersister.restoreClient())?.clientState.queries).toHaveLength(1)
  expect(await AsyncStorage.getItem('forward-logistica-store')).toContain('Almacén Don Pepe')
  return { qc, soltar: () => { dejarDeGuardar(); desconectar() } }
}

/** Every store of the previous session is empty. */
async function sinNadaDeLaSesion(qc: ReturnType<typeof crearQueryClient>) {
  const auth = useAuthStore.getState()
  expect({ isAuthenticated: auth.isAuthenticated, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user })
    .toEqual({ isAuthenticated: false, accessToken: null, refreshToken: null, user: null })
  expect(qc.getQueryCache().getAll()).toHaveLength(0)
  expect(qc.getMutationCache().getAll()).toHaveLength(0)
  // The disk holds nothing (not an empty client) even if the app dies right away.
  expect(await mmkvPersister.restoreClient()).toBeUndefined()
  expect(useLogisticaStore.getState().activeTrip).toBeNull()
  expect(await AsyncStorage.getItem('forward-logistica-store')).toBeNull()
  expect(mockSecure.has(CREDENCIAL_HUELLA)).toBe(false)
  // S2: "Se borra al cerrar sesión"; the next user of the phone is asked again, and an unanswered offer goes too.
  expect(mockSecure.has(DECISION_HUELLA)).toBe(false)
  expect(useOfertaDeHuella.getState().pendiente).toBeNull()
}

beforeEach(async () => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockSecure.clear()
  await AsyncStorage.clear()
})

describe('cerrarSesion(): the next user of the phone sees nothing of the previous one', () => {
  it('manual logout empties tokens, query cache, active trip and fingerprint credential', async () => {
    const { qc, soltar } = await conSesion()
    await cerrarSesion()
    await sinNadaDeLaSesion(qc)
    soltar()
  })

  it('forced logout (refresh rejected with 4xx) empties the same stores, also when only the tokens are dropped', async () => {
    const { qc, soltar } = await conSesion()
    // As hooks/useAuthGuard.ts configures it: it only drops the tokens; the wiring empties the rest.
    configureApiClient({
      getToken: () => useAuthStore.getState().accessToken,
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      onTokensRefreshed: (t) => useAuthStore.getState().setTokens(t),
      onUnauthorized: () => useAuthStore.getState().logout(),
    })
    responder(401, {})
    responder(400, { error: 'invalid_grant' })

    await expect(api.get('/api/v1/Inicio/resumen')).rejects.toMatchObject({ status: 401 })
    await new Promise((r) => setTimeout(r, 0))
    await sinNadaDeLaSesion(qc)
    soltar()
  })

  it('authenticating again (or rehydrating the session on app start) clears nothing', async () => {
    const { qc, soltar } = await conSesion()
    useAuthStore.setState({ isAuthenticated: true, accessToken: 't2' })
    expect(qc.getQueryData(['inicio', 'resumen'])).toBeTruthy()
    expect(await mmkvPersister.restoreClient()).toBeTruthy()
    expect(useLogisticaStore.getState().activeTrip).not.toBeNull()
    expect(mockSecure.has(CREDENCIAL_HUELLA)).toBe(true)
    soltar()
  })
})
