/**
 * logistica-store-partialize.test.ts
 *
 * TASK-5-D1: Verifies that the Zustand logistica store's `partialize` function
 * pins what each store persists: the id in the logistica store, the trip in its own store (S4).
 *
 * Uses the store module directly and inspects the partialize output rather than
 * going through AsyncStorage, keeping the test free of native module mocking.
 */

// Zustand persist with immer requires the store to be properly hydrated, but for
// the partialize contract test we only need to inspect what the function selects.
// We access it by extracting the partialize function from the persist config, which
// is embedded in the store's implementation. The simplest approach: call
// useLogisticaStore.getState() after setting a known state, then compare against
// what `partialize` would extract.

// Mock the native modules that the store indirectly pulls in.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}))

// The trip lives in the encrypted MMKV store (SEG-10); its native modules are out of reach with react-native mocked.
jest.mock('@/core/utils/storage', () => {
  const memoria = new Map<string, string>()
  const almacen = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, v) },
    removeItem: (k: string) => { memoria.delete(k) },
  }
  return {
    zustandStorage: almacen,
    zustandStorageMudadoDesde: () => almacen,
  }
})

// Mock react-native core modules used transitively by the store
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

import { useLogisticaStore } from '../store/logistica.store'
import { useHojaRutaGuardada } from '../store/hojaRutaGuardada.store'

const MOCK_ACTIVE_TRIP = {
  id: 'hoja-001',
  estado: 2, // EnCurso
  choferId: 'chofer-001',
  vehiculoId: 'vehiculo-001',
  detalles: [
    {
      id: 'parada-001',
      clienteNombre: 'Cliente A',
      direccion: 'Av. Corrientes 123',
      estado: 1, // Pendiente
    },
  ],
} as any

describe('logistica stores — what each one persists (S4)', () => {
  beforeEach(() => {
    useLogisticaStore.getState().reset()
  })

  it('the logistica store keeps only the id of the open trip', () => {
    useLogisticaStore.getState().setActiveTripId('hoja-001')
    const raw = useLogisticaStore.persist.getOptions().storage?.getItem('forward-logistica-store') as { state: object }
    expect(Object.keys(raw?.state ?? {})).toEqual(['activeTripId'])
  })

  it('the trip with its stops is saved by the dedicated store, with stop-level delivery state', () => {
    useHojaRutaGuardada.getState().guardar(MOCK_ACTIVE_TRIP)
    useHojaRutaGuardada.getState().updateStopStatus('parada-001', { delivered: true, observations: 'Entregado sin novedades' })

    const stop = useHojaRutaGuardada.getState().hoja?.detalles?.[0]
    expect(stop?.estado).toBe(2) // EstadoParada.Entregado
    expect(stop?.observaciones).toBe('Entregado sin novedades')
  })

  it('clearing the active trip clears the id and the saved trip', () => {
    useHojaRutaGuardada.getState().guardar(MOCK_ACTIVE_TRIP)
    useLogisticaStore.getState().setActiveTripId('hoja-001')
    useLogisticaStore.getState().clearActiveTrip()

    expect(useLogisticaStore.getState().activeTripId).toBeNull()
    expect(useHojaRutaGuardada.getState().hoja).toBeNull()
  })
})
