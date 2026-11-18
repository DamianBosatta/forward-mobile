/**
 * Audit tranche 1, S3: the MMKV encryption key is random, generated on the first start and kept in SecureStore
 * (without requireAuthentication: the app reads it before anyone touches the screen). It is no longer a literal
 * in the binary. The file encrypted with the old literal key is re-encrypted in place with the new one (`recrypt`),
 * so updating the app loses nothing and nobody is logged out.
 *
 * SEG-01 (re-audit 3): a Keystore that cannot be read, or that answers "no key" once a key was saved, never opens the
 * file with a throwaway key: that would discard the offline queues without a signal. The app blocks with Reintentar.
 */
const mockSecure = new Map<string, string>()
const mockSetItem = jest.fn((k: string, v: string, _o?: unknown) => { mockSecure.set(k, v) })
const mockGetItem = jest.fn((k: string): string | null => mockSecure.get(k) ?? null)
const mockDeleteItemAsync = jest.fn(async (k: string) => { mockSecure.delete(k) })
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItem: (k: string) => mockGetItem(k),
  setItem: (k: string, v: string, o?: unknown) => mockSetItem(k, v, o),
  deleteItemAsync: (k: string) => mockDeleteItemAsync(k),
}))
const mockRandomBytes = jest.fn((n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256))
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => mockRandomBytes(n) }))

/**
 * The MMKV files on disk, by id: a file's content only reads with the key it is encrypted with (none for a plain
 * file), and `recrypt` re-encrypts it in place, as the native module does.
 */
type Archivo = { clave: string | undefined; datos: Map<string, string> }
const mockArchivos = new Map<string, Archivo>()
const mockRecrypt = jest.fn((_clave: string) => {})
const mockCreateMMKV = jest.fn((config: { id: string; encryptionKey?: string }) => {
  let archivo = mockArchivos.get(config.id)
  if (!archivo || archivo.clave !== config.encryptionKey) {
    // Wrong key: the native module discards what it cannot decrypt.
    archivo = { clave: config.encryptionKey, datos: new Map() }
    mockArchivos.set(config.id, archivo)
  }
  const abierto = archivo
  return {
    set: (k: string, v: string) => { abierto.datos.set(k, v) },
    getString: (k: string) => abierto.datos.get(k),
    remove: (k: string) => abierto.datos.delete(k),
    recrypt: (k: string) => {
      mockRecrypt(k)
      abierto.clave = k
    },
  }
})
jest.mock('react-native-mmkv', () => ({
  createMMKV: (c: { id: string; encryptionKey?: string }) => mockCreateMMKV(c),
  existsMMKV: (id: string) => mockArchivos.has(id),
}))

const ID = 'forward-app-storage'
const ID_MARCAS = 'forward-app-storage-marcas'
const CLAVE = 'forward_mmkv_key'
const CLAVE_VIEJA = 'forward-mmkv-v1-3f9a8d7c2e1b6a5d'
const CLAVE_GUARDADA = 'abcdefghijklmnop'
/** 12 random bytes as 16 base64 characters: what AES-128 (MMKV's default type) accepts. */
const CLAVE_NUEVA = /^[A-Za-z0-9+/]{16}$/

type Config = { id: string; encryptionKey?: string; encryptionType?: string }
type Modulo = typeof import('../storage')

/** Loads `storage.ts` as a fresh app start does. `config` is the last open of the encrypted file, if any. */
function arrancarLaApp() {
  const desde = mockCreateMMKV.mock.calls.length
  let modulo: Modulo | undefined
  jest.isolateModules(() => { modulo = require('../storage') })
  const aperturas = mockCreateMMKV.mock.calls.slice(desde).map((c) => c[0] as Config).filter((c) => c.id === ID)
  return { config: aperturas.at(-1), aperturas, storage: modulo!.storage, modulo: modulo! }
}

const archivo = () => mockArchivos.get(ID)
const marcas = () => mockArchivos.get(ID_MARCAS)?.datos

/** A phone updated from a build that encrypted the file with the literal key, with a session saved. */
function telefonoConLaVersionAnterior() {
  mockArchivos.set(ID, { clave: CLAVE_VIEJA, datos: new Map([['auth-storage', '{"accessToken":"t1"}']]) })
}

/** A phone already on the per-install key, with a pending offline queue, on the build that writes the marker. */
function telefonoConClaveYColas() {
  mockSecure.set(CLAVE, CLAVE_GUARDADA)
  mockArchivos.set(ID, { clave: CLAVE_GUARDADA, datos: new Map([['cola-consola-7', '[{"parada":1}]']]) })
  mockArchivos.set(ID_MARCAS, { clave: undefined, datos: new Map([['clave-guardada', '1']]) })
}

/** The encrypted file is untouched: same key, same content. */
function expectArchivoIntacto() {
  expect(archivo()?.clave).toBe(CLAVE_GUARDADA)
  expect(archivo()?.datos.get('cola-consola-7')).toBe('[{"parada":1}]')
}

const keystoreRoto = () => mockGetItem.mockImplementation(() => { throw new Error('Keystore unavailable') })
const keystoreSano = () => mockGetItem.mockImplementation((k: string) => mockSecure.get(k) ?? null)

beforeEach(() => {
  jest.clearAllMocks()
  keystoreSano()
  mockSecure.clear()
  mockArchivos.clear()
})

describe('MMKV encryption key', () => {
  it('updating migrates in place: the data written under the old key reads after the update and on later starts', () => {
    telefonoConLaVersionAnterior()
    const { config, storage, modulo } = arrancarLaApp()
    expect(config).toEqual({ id: ID, encryptionKey: CLAVE_VIEJA })
    expect(mockRandomBytes).toHaveBeenCalledWith(12)
    const nueva = mockSecure.get(CLAVE)
    expect(nueva).toMatch(CLAVE_NUEVA)
    expect(mockRecrypt).toHaveBeenCalledWith(nueva)
    expect(mockSetItem.mock.invocationCallOrder[0]).toBeLessThan(mockRecrypt.mock.invocationCallOrder[0])
    expect(storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: false })
    // From now on a missing key is a loss, not a first start. The marker holds no secret.
    expect(marcas()?.get('clave-guardada')).toBe('1')

    const despues = arrancarLaApp()
    expect(despues.config?.encryptionKey).toBe(nueva)
    expect(despues.storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')
  })

  it('first install (no file, no marker): a new key is saved, the file opens with it and the marker is set', () => {
    const { aperturas, storage, modulo } = arrancarLaApp()
    const nueva = mockSecure.get(CLAVE)
    expect(nueva).toMatch(CLAVE_NUEVA)
    expect(aperturas).toEqual([{ id: ID, encryptionKey: nueva }])
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: false })
    expect(marcas()?.get('clave-guardada')).toBe('1')
    storage.set('cola-consola-7', '[]')
    expect(archivo()?.datos.get('cola-consola-7')).toBe('[]')
  })

  it('the new key is stored without requireAuthentication and only on this device', () => {
    arrancarLaApp()
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    const opciones = mockSetItem.mock.calls[0][2] as { requireAuthentication?: boolean; keychainAccessible?: number }
    expect(opciones.requireAuthentication).toBeFalsy()
    expect(opciones.keychainAccessible).toBe(0)
  })

  it('with a key already in SecureStore, the file opens with it and nothing is migrated or generated', () => {
    mockSecure.set(CLAVE, CLAVE_GUARDADA)
    mockArchivos.set(ID, { clave: CLAVE_GUARDADA, datos: new Map([['auth-storage', 'sesion']]) })
    const { config, storage, modulo } = arrancarLaApp()
    expect(config).toEqual({ id: ID, encryptionKey: CLAVE_GUARDADA })
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(mockRandomBytes).not.toHaveBeenCalled()
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(storage.getString('auth-storage')).toBe('sesion')
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: false })
    // A phone that migrated on an older build gets the marker on its first good start.
    expect(marcas()?.get('clave-guardada')).toBe('1')
  })

  it('if the new key cannot be saved, nothing is re-encrypted and this run keeps the old key (retried next start)', () => {
    telefonoConLaVersionAnterior()
    mockSetItem.mockImplementationOnce(() => { throw new Error('Keystore unavailable') })
    const { config, storage } = arrancarLaApp()
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(config?.encryptionKey).toBe(CLAVE_VIEJA)
    expect(storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')
    expect(marcas()?.get('clave-guardada')).toBeUndefined()

    arrancarLaApp()
    expect(mockRecrypt).toHaveBeenCalledWith(mockSecure.get(CLAVE))
  })

  it('if re-encrypting fails, the saved key is deleted so the next start retries, and this run keeps working', () => {
    telefonoConLaVersionAnterior()
    mockRecrypt.mockImplementationOnce(() => { throw new Error('Failed to encrypt MMKV instance!') })
    const { storage } = arrancarLaApp()
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(CLAVE)
    expect(mockSecure.has(CLAVE)).toBe(false)
    expect(storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')
    expect(marcas()?.get('clave-guardada')).toBeUndefined()
  })

  // Replaces "if SecureStore cannot be read, the app still starts encrypted with a fresh random key": that throwaway
  // key discarded the file, and the offline queues with it, without any signal (SEG-01).
  it('if SecureStore keeps throwing, nothing opens the file, no key is written and the app is blocked', () => {
    telefonoConClaveYColas()
    keystoreRoto()
    const { aperturas, storage, modulo } = arrancarLaApp()
    expect(mockGetItem).toHaveBeenCalledTimes(3)
    expect(aperturas).toEqual([])
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(mockDeleteItemAsync).not.toHaveBeenCalled()
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: true, motivo: 'keystore-ilegible' })
    expect(mockSecure.get(CLAVE)).toBe(CLAVE_GUARDADA)
    expectArchivoIntacto()
    // The stand-in never reaches the real file: it shows nothing of it and writes nothing to it.
    expect(storage.getString('cola-consola-7')).toBeUndefined()
    storage.set('cola-consola-7', '[]')
    storage.remove('cola-consola-7')
    expectArchivoIntacto()
  })

  it('a Keystore that fails once and then answers opens the file with the saved key in the same start', () => {
    telefonoConClaveYColas()
    mockGetItem.mockImplementationOnce(() => { throw new Error('Keystore busy') })
    const { config, storage, modulo } = arrancarLaApp()
    expect(config).toEqual({ id: ID, encryptionKey: CLAVE_GUARDADA })
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: false })
    expect(storage.getString('cola-consola-7')).toBe('[{"parada":1}]')
  })

  it('no key after one was saved (marker set) blocks: no new key, no migration, the file is not touched', () => {
    telefonoConClaveYColas()
    mockSecure.delete(CLAVE)
    const { aperturas, modulo } = arrancarLaApp()
    expect(aperturas).toEqual([])
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(mockRandomBytes).not.toHaveBeenCalled()
    expect(modulo.estadoDelAlmacen()).toEqual({ bloqueado: true, motivo: 'clave-perdida' })
    expectArchivoIntacto()
  })

  it('a forced logout while blocked clears only the stand-in: the real file keeps the session and the queues', () => {
    telefonoConClaveYColas()
    archivo()!.datos.set('auth-storage', '{"accessToken":"t1"}')
    keystoreRoto()
    const { modulo } = arrancarLaApp()
    modulo.zustandStorage.removeItem('auth-storage')
    modulo.storage.remove('REACT_QUERY_OFFLINE_CACHE')
    expect(archivo()?.datos.get('auth-storage')).toBe('{"accessToken":"t1"}')
    expectArchivoIntacto()
  })

  it('Reintentar after a transient failure: the key reads again and the reloaded app opens the file with it', () => {
    telefonoConClaveYColas()
    keystoreRoto()
    const bloqueado = arrancarLaApp()
    expect(bloqueado.modulo.sePuedeAbrirElAlmacen()).toBe(false)
    expect(mockSetItem).not.toHaveBeenCalled()

    keystoreSano()
    expect(bloqueado.modulo.sePuedeAbrirElAlmacen()).toBe(true)
    // Checking opens and writes nothing: the reload opens the file.
    expect(mockCreateMMKV.mock.calls.filter((c) => c[0].id === ID)).toEqual([])
    expect(mockSetItem).not.toHaveBeenCalled()

    const recargada = arrancarLaApp()
    expect(recargada.config).toEqual({ id: ID, encryptionKey: CLAVE_GUARDADA })
    expect(recargada.modulo.estadoDelAlmacen()).toEqual({ bloqueado: false })
    expect(recargada.storage.getString('cola-consola-7')).toBe('[{"parada":1}]')
  })
})

describe('app.config.ts', () => {
  it('turns Android backup off, so the data and the key do not leave the phone', () => {
    const config = require('../../../../app.config').default
    expect(config.android.allowBackup).toBe(false)
  })
})

/**
 * SEG-10: a key that used to live in AsyncStorage (plain text) moves to the encrypted store, and no plain copy stays
 * behind once the encrypted one exists, whatever left it there (an interrupted move or an older build writing it).
 */
describe('zustandStorageMudadoDesde', () => {
  function adaptador(plano: Map<string, string>) {
    let modulo: typeof import('../storage') | undefined
    jest.isolateModules(() => { modulo = require('../storage') })
    const almacenPlano = {
      getItem: jest.fn(async (k: string) => plano.get(k) ?? null),
      removeItem: jest.fn(async (k: string) => { plano.delete(k) }),
    }
    return { mudado: modulo!.zustandStorageMudadoDesde(almacenPlano), almacenPlano }
  }
  const esperarPendientes = () => new Promise((r) => setImmediate(r))

  it('with the encrypted value present, a read returns it and removes the plain copy', async () => {
    const plano = new Map([['logistica-storage', '{"viaje":"plano"}']])
    const { mudado } = adaptador(plano)
    mudado.setItem('logistica-storage', '{"viaje":"cifrado"}')

    expect(await mudado.getItem('logistica-storage')).toBe('{"viaje":"cifrado"}')
    await esperarPendientes()
    expect(plano.has('logistica-storage')).toBe(false)
  })

  it('with only the plain value, a read moves it to the encrypted store and removes the plain copy', async () => {
    const plano = new Map([['logistica-storage', '{"viaje":"plano"}']])
    const { mudado } = adaptador(plano)

    expect(await mudado.getItem('logistica-storage')).toBe('{"viaje":"plano"}')
    expect(plano.has('logistica-storage')).toBe(false)
    expect(archivo()?.datos.get('logistica-storage')).toBe('{"viaje":"plano"}')
  })

  it('if removing the plain copy fails, the read still returns the encrypted value', async () => {
    const { mudado, almacenPlano } = adaptador(new Map())
    almacenPlano.removeItem.mockRejectedValueOnce(new Error('AsyncStorage unavailable'))
    mudado.setItem('logistica-storage', 'cifrado')

    expect(await mudado.getItem('logistica-storage')).toBe('cifrado')
    await esperarPendientes()
    expect(almacenPlano.removeItem).toHaveBeenCalledWith('logistica-storage')
  })
})
