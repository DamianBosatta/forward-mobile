import { createMMKV } from 'react-native-mmkv'

/**
 * MMKV Instance — encrypted at rest.
 *
 * The encryption key is a static, app-scoped secret bundled in the binary.
 * On a non-rooted device this prevents trivial inspection of the MMKV file
 * via adb / file manager. It does NOT protect against a rooted device with
 * access to the running app's memory or binary strings.
 *
 * For stronger guarantees (per-install key persisted in SecureStore so the
 * key is not in the binary at all) see the roadmap follow-up in the audit
 * report — that migration is async and requires hydration sequencing.
 */
const STORAGE_ID = 'forward-app-storage'
const STORAGE_ENCRYPTION_KEY = 'forward-mmkv-v1-3f9a8d7c2e1b6a5d'

export const storage = createMMKV({
  id: STORAGE_ID,
  encryptionKey: STORAGE_ENCRYPTION_KEY,
})

/**
 * Adapter for Zustand/React-Query that expects synchronous Storage-like interface
 */
export const zustandStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value)
  },
  getItem: (name: string) => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: (name: string) => {
    return storage.remove(name)
  },
}
