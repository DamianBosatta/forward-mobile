import { getRandomBytes } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createMMKV } from 'react-native-mmkv'

/**
 * MMKV instance, encrypted at rest with a per-install key (audit tranche 1, S3).
 *
 * The key is random, generated on the first start and kept in SecureStore (Keystore / Keychain), so it is not in
 * the binary. It is stored without `requireAuthentication`: the app needs it before anyone touches the screen.
 * There is no migration of the file encrypted with the old literal key (owner's decision "Cierre de sesión único al
 * actualizar"): with the new key that content does not decrypt and the person logs in once more.
 */
const STORAGE_ID = 'forward-app-storage'
const STORAGE_KEY_NAME = 'forward_mmkv_key'

/**
 * 16 random bytes as 32 hex characters: the 32-byte key AES-256 accepts. If the Keystore cannot be read or written
 * (it happens on some Android phones), the app still starts with a fresh key: the stored data does not decrypt and
 * the person logs in again, the same as after this update.
 */
function clavePorInstalacion(): string {
  const guardada = leerClaveGuardada()
  if (guardada) return guardada
  const nueva = Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('')
  try {
    // AFTER_FIRST_UNLOCK: readable when the app wakes up in the background; THIS_DEVICE_ONLY: never leaves the phone.
    SecureStore.setItem(STORAGE_KEY_NAME, nueva, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
  } catch {
    // Not saved: this run works; the next start generates another key.
  }
  return nueva
}

function leerClaveGuardada(): string | null {
  try {
    return SecureStore.getItem(STORAGE_KEY_NAME)
  } catch {
    return null
  }
}

export const storage = createMMKV({
  id: STORAGE_ID,
  encryptionKey: clavePorInstalacion(),
  encryptionType: 'AES-256',
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
