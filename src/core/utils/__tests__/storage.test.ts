/**
 * Audit tranche 1, S3: the MMKV encryption key is random, generated on the first start and kept in SecureStore
 * (without requireAuthentication: the app reads it before anyone touches the screen). It is no longer a literal
 * in the binary. The file encrypted with the old literal key is re-encrypted in place with the new one (`recrypt`),
 * so updating the app loses nothing and nobody is logged out.
 */
const mockSecure = new Map<string, string>()
const mockSetItem = jest.fn((k: string, v: string, _o?: unknown) => { mockSecure.set(k, v) })
const mockGetItem = jest.fn((k: string) => mockSecure.get(k) ?? null)
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
 * The MMKV file on disk: its content only reads with the key it is encrypted with, and `recrypt` re-encrypts it
 * in place, as the native module does.
 */
const mockArchivo: { clave: string; datos: Map<string, string> } = { clave: '', datos: new Map() }
const mockRecrypt = jest.fn((clave: string) => { mockArchivo.clave = clave })
const mockCreateMMKV = jest.fn((config: { encryptionKey: string }) => {
  if (mockArchivo.clave !== config.encryptionKey) {
    // Wrong key: the native module discards what it cannot decrypt.
    mockArchivo.clave = config.encryptionKey
    mockArchivo.datos = new Map()
  }
  return {
    set: (k: string, v: string) => { mockArchivo.datos.set(k, v) },
    getString: (k: string) => mockArchivo.datos.get(k),
    remove: (k: string) => { mockArchivo.datos.delete(k) },
    recrypt: (k: string) => mockRecrypt(k),
  }
})
jest.mock('react-native-mmkv', () => ({ createMMKV: (c: { encryptionKey: string }) => mockCreateMMKV(c) }))

const CLAVE = 'forward_mmkv_key'
const CLAVE_VIEJA = 'forward-mmkv-v1-3f9a8d7c2e1b6a5d'
/** 12 random bytes as 16 base64 characters: what AES-128 (MMKV's default type) accepts. */
const CLAVE_NUEVA = /^[A-Za-z0-9+/]{16}$/

type Config = { id: string; encryptionKey: string; encryptionType?: string }

/** Loads `storage.ts` as a fresh app start does. */
function arrancarLaApp() {
  let modulo: { storage: { getString: (k: string) => string | undefined } } | undefined
  jest.isolateModules(() => { modulo = require('../storage') })
  return { config: mockCreateMMKV.mock.calls.at(-1)?.[0] as Config, storage: modulo!.storage }
}

/** A phone updated from a build that encrypted the file with the literal key, with a session saved. */
function telefonoConLaVersionAnterior() {
  mockArchivo.clave = CLAVE_VIEJA
  mockArchivo.datos = new Map([['auth-storage', '{"accessToken":"t1"}']])
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSecure.clear()
  mockArchivo.clave = ''
  mockArchivo.datos = new Map()
})

describe('MMKV encryption key', () => {
  it('updating migrates in place: the data written under the old key reads after the update and on later starts', () => {
    telefonoConLaVersionAnterior()
    const { config, storage } = arrancarLaApp()
    expect(config).toEqual({ id: 'forward-app-storage', encryptionKey: CLAVE_VIEJA })
    expect(mockRandomBytes).toHaveBeenCalledWith(12)
    const nueva = mockSecure.get(CLAVE)
    expect(nueva).toMatch(CLAVE_NUEVA)
    expect(mockRecrypt).toHaveBeenCalledWith(nueva)
    expect(mockSetItem.mock.invocationCallOrder[0]).toBeLessThan(mockRecrypt.mock.invocationCallOrder[0])
    expect(storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')

    const despues = arrancarLaApp()
    expect(despues.config.encryptionKey).toBe(nueva)
    expect(despues.storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')
  })

  it('the new key is stored without requireAuthentication and only on this device', () => {
    arrancarLaApp()
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    const opciones = mockSetItem.mock.calls[0][2] as { requireAuthentication?: boolean; keychainAccessible?: number }
    expect(opciones.requireAuthentication).toBeFalsy()
    expect(opciones.keychainAccessible).toBe(0)
  })

  it('with a key already in SecureStore, the file opens with it and nothing is migrated or generated', () => {
    mockSecure.set(CLAVE, 'abcdefghijklmnop')
    mockArchivo.clave = 'abcdefghijklmnop'
    mockArchivo.datos = new Map([['auth-storage', 'sesion']])
    const { config, storage } = arrancarLaApp()
    expect(config).toEqual({ id: 'forward-app-storage', encryptionKey: 'abcdefghijklmnop' })
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(mockRandomBytes).not.toHaveBeenCalled()
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(storage.getString('auth-storage')).toBe('sesion')
  })

  it('if the new key cannot be saved, nothing is re-encrypted and this run keeps the old key (retried next start)', () => {
    telefonoConLaVersionAnterior()
    mockSetItem.mockImplementationOnce(() => { throw new Error('Keystore unavailable') })
    const { config, storage } = arrancarLaApp()
    expect(mockRecrypt).not.toHaveBeenCalled()
    expect(config.encryptionKey).toBe(CLAVE_VIEJA)
    expect(storage.getString('auth-storage')).toBe('{"accessToken":"t1"}')

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
  })

  it('if SecureStore cannot be read, the app still starts encrypted with a fresh random key and saves nothing', () => {
    mockGetItem.mockImplementationOnce(() => { throw new Error('Keystore unavailable') })
    const { config } = arrancarLaApp()
    expect(config.encryptionKey).toMatch(CLAVE_NUEVA)
    expect(config.encryptionKey).not.toBe(CLAVE_VIEJA)
    expect(mockRecrypt).not.toHaveBeenCalled()
  })
})

describe('app.config.ts', () => {
  it('turns Android backup off, so the data and the key do not leave the phone', () => {
    const config = require('../../../../app.config').default
    expect(config.android.allowBackup).toBe(false)
  })
})
