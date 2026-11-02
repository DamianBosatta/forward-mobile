/**
 * Audit tranche 1, S3: the MMKV encryption key is random, generated on the first start and kept in SecureStore
 * (without requireAuthentication: the app reads it before anyone touches the screen). It is no longer a literal
 * in the binary. Owner's decision "Cierre de sesión único al actualizar": no migration of the old file.
 */
const mockSecure = new Map<string, string>()
const mockSetItem = jest.fn((k: string, v: string, _o?: unknown) => { mockSecure.set(k, v) })
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItem: (k: string) => mockSecure.get(k) ?? null,
  setItem: (k: string, v: string, o?: unknown) => mockSetItem(k, v, o),
}))
const mockRandomBytes = jest.fn((n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256))
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => mockRandomBytes(n) }))
const mockCreateMMKV = jest.fn((_config: unknown) => ({ set: jest.fn(), getString: jest.fn(), remove: jest.fn() }))
jest.mock('react-native-mmkv', () => ({ createMMKV: (c: unknown) => mockCreateMMKV(c) }))

const CLAVE = 'forward_mmkv_key'

/** Loads `storage.ts` as a fresh app start does. */
function arrancarLaApp() {
  jest.isolateModules(() => { require('../storage') })
  return mockCreateMMKV.mock.calls.at(-1)?.[0] as { id: string; encryptionKey: string; encryptionType: string }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSecure.clear()
})

describe('MMKV encryption key', () => {
  it('the first start generates a random key, keeps it in SecureStore and encrypts with it', () => {
    const config = arrancarLaApp()
    expect(mockRandomBytes).toHaveBeenCalledTimes(1)
    const guardada = mockSecure.get(CLAVE)
    expect(guardada).toMatch(/^[0-9a-f]{32}$/)
    expect(config).toMatchObject({ id: 'forward-app-storage', encryptionKey: guardada, encryptionType: 'AES-256' })
    expect(config.encryptionKey).not.toBe('forward-mmkv-v1-3f9a8d7c2e1b6a5d')
  })

  it('the key is stored without requireAuthentication', () => {
    arrancarLaApp()
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    const opciones = mockSetItem.mock.calls[0][2] as { requireAuthentication?: boolean } | undefined
    expect(opciones?.requireAuthentication).toBeFalsy()
  })

  it('later starts reuse the saved key and generate nothing', () => {
    const primera = arrancarLaApp()
    jest.clearAllMocks()
    const segunda = arrancarLaApp()
    expect(mockRandomBytes).not.toHaveBeenCalled()
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(segunda.encryptionKey).toBe(primera.encryptionKey)
  })

  it('if the Keystore fails, the app still starts encrypted with a fresh random key', () => {
    mockSetItem.mockImplementationOnce(() => { throw new Error('Keystore unavailable') })
    const config = arrancarLaApp()
    expect(config.encryptionKey).toMatch(/^[0-9a-f]{32}$/)
    expect(config.encryptionType).toBe('AES-256')
  })
})

describe('app.config.ts', () => {
  it('turns Android backup off, so the data and the key do not leave the phone', () => {
    const config = require('../../../../app.config').default
    expect(config.android.allowBackup).toBe(false)
  })
})
