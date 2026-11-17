/**
 * SEG-10: the active trip (stops, customers and addresses) is kept in the encrypted MMKV store, not in plain
 * AsyncStorage. A phone updated from a build that kept it in AsyncStorage keeps its trip: the first read moves it to
 * MMKV and deletes the plain copy.
 */
const CLAVE = 'forward-logistica-store'
const VIAJE = { id: 'hoja-7', detalles: [{ id: 'p1', clienteNombre: 'Almacén Don Pepe', direccion: 'Tarantino 1898' }] }

function cargar() {
  let mod: {
    store: typeof import('../store/logistica.store').useLogisticaStore
    mmkv: typeof import('@/core/utils/storage').zustandStorage
    plano: typeof import('@react-native-async-storage/async-storage').default
  } | undefined
  jest.isolateModules(() => {
    mod = {
      store: require('../store/logistica.store').useLogisticaStore,
      mmkv: require('@/core/utils/storage').zustandStorage,
      // Same registry as the store, so this is the AsyncStorage the store reads.
      plano: require('@react-native-async-storage/async-storage'),
    }
  })
  return mod!
}

describe('active trip storage (SEG-10)', () => {
  it('a trip saved by an older build moves to the encrypted store and the plain copy is deleted', async () => {
    const { store, mmkv, plano } = cargar()
    await plano.setItem(CLAVE, JSON.stringify({ state: { activeTrip: VIAJE }, version: 0 }))

    await store.persist.rehydrate()

    expect(store.getState().activeTrip?.id).toBe('hoja-7')
    expect(mmkv.getItem(CLAVE)).toContain('Almacén Don Pepe')
    expect(await plano.getItem(CLAVE)).toBeNull()
  })

  it('a new trip is written to the encrypted store, never to AsyncStorage', async () => {
    const { store, mmkv, plano } = cargar()
    await store.persist.rehydrate()

    store.getState().setActiveTrip(VIAJE as never)

    expect(mmkv.getItem(CLAVE)).toContain('Almacén Don Pepe')
    expect(await plano.getItem(CLAVE)).toBeNull()
  })

  it('clearing the store deletes the trip from both places', async () => {
    const { store, mmkv, plano } = cargar()
    await plano.setItem(CLAVE, JSON.stringify({ state: { activeTrip: VIAJE }, version: 0 }))
    mmkv.setItem(CLAVE, JSON.stringify({ state: { activeTrip: VIAJE }, version: 0 }))

    await store.persist.clearStorage()

    expect(mmkv.getItem(CLAVE)).toBeNull()
    expect(await plano.getItem(CLAVE)).toBeNull()
  })
})
