/**
 * ARQ-05 / S4: "Un guardado propio solo para la hoja de ruta, que vence al cerrar el viaje y no con el tiempo ni con
 * una OTA. El store queda solo con el id."
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { useHojaRutaGuardada } from '@/features/logistica/store/hojaRutaGuardada.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import ConsolaChoferScreen from '../../../../app/(tabs)/logistica/consola'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))
jest.mock('@/features/logistica/components/PedidoDetalleModal', () => ({ PedidoDetalleModal: () => null }))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))

// One storage shared by every module registry, so `reiniciar()` reads what the previous "run" of the app wrote.
jest.mock('@/core/utils/storage', () => {
  const g = globalThis as unknown as { __memoriaS4?: Map<string, string> }
  const memoria = (g.__memoriaS4 ??= new Map<string, string>())
  const almacen = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, v) },
    removeItem: (k: string) => { memoria.delete(k) },
  }
  return { ...jest.requireActual('@/core/utils/storage'), zustandStorage: almacen, zustandStorageMudadoDesde: () => almacen }
})

const CLAVE_STORE = 'forward-logistica-store'
const CLAVE_HOJA = 'forward-hoja-ruta-guardada'
const HOJA = {
  id: 'h1', choferId: 'u1', choferNombre: 'Carlos Chofer', vehiculoId: 'x', vehiculoPatente: 'AB 123 CD',
  estado: 2, fechaSalida: '2026-10-07T11:00:00Z',
  detalles: [
    { id: 'p4', orden: 4, ventaId: 'v', telefono: '11 4567-8900', cantidadBultos: 3, latitud: 0, longitud: 0, estado: 1,
      direccion: 'Juan B. Justo 6376', clienteNombre: 'Carlos', montoTotal: 214560 },
  ],
}
const USUARIO = {
  id: 'u1', username: 'c', nombre: 'Carlos', apellido: 'Chofer', roles: [], permissions: [{ module: 'MOD_VIAJES', canRead: true }],
}

function pintar() {
  useAuthStore.setState({ user: USUARIO } as never)
  // A new QueryClient with an empty cache: what a restart >24 h later, or the first start after an OTA (new
  // buster), leaves in react-query.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ConsolaChoferScreen /></QueryClientProvider>)
}

type Almacen = { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Loads fresh copies of the stores over the same storage, like an app restart. */
function reiniciar() {
  let mod!: { store: typeof useLogisticaStore; guardada: typeof useHojaRutaGuardada; mmkv: Almacen }
  jest.isolateModules(() => {
    mod = {
      store: require('../store/logistica.store').useLogisticaStore,
      guardada: require('../store/hojaRutaGuardada.store').useHojaRutaGuardada,
      mmkv: require('@/core/utils/storage').zustandStorage,
    }
  })
  return mod
}

beforeEach(() => {
  ;(globalThis as unknown as { __memoriaS4?: Map<string, string> }).__memoriaS4?.clear()
  jest.clearAllMocks()
  useLogisticaStore.getState().reset()
  conTema('light')
})

describe('hoja de ruta guardada (S4)', () => {
  it('restart with no network 25 h after the last fetch: the trip and its stops are still shown', async () => {
    useHojaRutaGuardada.getState().guardar(HOJA as never)
    useLogisticaStore.getState().setActiveTripId('h1')
    mockGet.mockRejectedValue(new Error('Network request failed'))
    const ahora = Date.now()
    const reloj = jest.spyOn(Date, 'now').mockReturnValue(ahora + 25 * 60 * 60_000)

    pintar()

    expect(await screen.findByLabelText('Próxima parada')).toBeTruthy()
    expect(screen.getByText('Juan B. Justo 6376')).toBeTruthy()
    reloj.mockRestore()
  })

  it('restart after an OTA (the buster changed): the dedicated persistence is not touched by it', () => {
    const { guardada: antes } = reiniciar()
    antes.getState().guardar(HOJA as never)
    // The OTA only changes the react-query buster (`versionDeCache`); this store has none.
    jest.doMock('expo-updates', () => ({ updateId: 'otra-actualizacion' }))
    const { guardada: despues, mmkv } = reiniciar()
    expect(mmkv.getItem(CLAVE_HOJA)).toContain('Juan B. Justo 6376')
    expect(despues.getState().hoja?.id).toBe('h1')
  })

  it('closing the trip clears the dedicated persistence; a new trip does not show the old stops', () => {
    const { store, guardada, mmkv } = reiniciar()
    guardada.getState().guardar(HOJA as never)
    store.getState().setActiveTripId('h1')

    store.getState().clearActiveTrip()
    expect(mmkv.getItem(CLAVE_HOJA)).not.toContain('Juan B. Justo 6376')
    expect(reiniciar().guardada.getState().hoja).toBeNull()

    guardada.getState().guardar({ ...HOJA, id: 'h2', detalles: [] } as never)
    expect(guardada.getState().hoja?.detalles).toEqual([])
  })

  it('migration: an old store with `activeTrip` leaves only the id in the store and the trip available offline', async () => {
    const { mmkv } = reiniciar()
    mmkv.setItem(CLAVE_STORE, JSON.stringify({ state: { activeTrip: HOJA }, version: 0 }))
    const { store, guardada } = reiniciar()
    await store.persist.rehydrate()

    expect(store.getState().activeTripId).toBe('h1')
    expect(guardada.getState().hoja?.detalles?.[0].direccion).toBe('Juan B. Justo 6376')
    expect(JSON.parse(mmkv.getItem(CLAVE_STORE) as string).state).toEqual({ activeTripId: 'h1' })
    // And after yet another restart the trip is still there.
    expect(reiniciar().guardada.getState().hoja?.id).toBe('h1')
  })

  it('a saved shape of another version is discarded, not read', async () => {
    const { mmkv } = reiniciar()
    mmkv.setItem(CLAVE_HOJA, JSON.stringify({ state: { hoja: { id: 'x', formaNueva: true } }, version: 99 }))
    const { guardada } = reiniciar()
    await guardada.persist.rehydrate()
    expect(guardada.getState().hoja).toBeNull()
  })

  it('online the trip is refreshed from the server and saved again', async () => {
    useHojaRutaGuardada.getState().guardar({ ...HOJA, detalles: [] } as never)
    useLogisticaStore.getState().setActiveTripId('h1')
    mockGet.mockImplementation((url: string) => (url.endsWith('/hojas-ruta/h1') ? Promise.resolve(HOJA) : Promise.resolve([])))

    pintar()

    expect(await screen.findByText('Juan B. Justo 6376')).toBeTruthy()
    expect(useHojaRutaGuardada.getState().hoja?.detalles).toHaveLength(1)
  })
})
