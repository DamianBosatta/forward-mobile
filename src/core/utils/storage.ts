import { getRandomBytes } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createMMKV } from 'react-native-mmkv'

/**
 * MMKV instance, encrypted at rest with a per-install key (audit tranche 1, S3).
 *
 * The key is random, generated on the first start and kept in SecureStore (Keystore / Keychain), so it is not in
 * the binary. It is stored without `requireAuthentication`: the app needs it before anyone touches the screen.
 * A phone updated from a build that used the old literal key keeps its data: the file opens with the old key and
 * is re-encrypted in place with the new one (`recrypt`), so nobody is logged out and no offline queue is lost.
 *
 * Encryption type: MMKV's default (AES-128). `recrypt` always re-encrypts as AES-128 (react-native-mmkv 4.3.1,
 * `HybridMMKV::recrypt` calls `encrypt(key, nullopt)`), so a file opened as AES-256 would not reopen after it.
 * AES-128 takes at most 16 bytes of key, hence 12 random bytes written as 16 base64 characters: 96 bits.
 */
const STORAGE_ID = 'forward-app-storage'
const STORAGE_KEY_NAME = 'forward_mmkv_key'
/** Migration only: the literal key builds before audit tranche 1 encrypted the file with. Never for new data. */
const LEGACY_MIGRATION_ONLY_KEY = 'forward-mmkv-v1-3f9a8d7c2e1b6a5d'

type ClaveGuardada = { estado: 'guardada'; clave: string } | { estado: 'sin-clave' } | { estado: 'ilegible' }

function leerClaveGuardada(): ClaveGuardada {
  try {
    const clave = SecureStore.getItem(STORAGE_KEY_NAME)
    return clave ? { estado: 'guardada', clave } : { estado: 'sin-clave' }
  } catch {
    return { estado: 'ilegible' }
  }
}

const claveNueva = () => btoa(String.fromCharCode(...getRandomBytes(12)))

function guardarClave(clave: string): boolean {
  try {
    // AFTER_FIRST_UNLOCK: readable when the app wakes up in the background; THIS_DEVICE_ONLY: never leaves the phone.
    SecureStore.setItem(STORAGE_KEY_NAME, clave, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
    return true
  } catch {
    return false
  }
}

function abrirAlmacen() {
  const guardada = leerClaveGuardada()
  if (guardada.estado === 'guardada') return createMMKV({ id: STORAGE_ID, encryptionKey: guardada.clave })
  if (guardada.estado === 'ilegible') {
    // The Keystore fails on some Android phones: start encrypted with a fresh key. What was stored does not
    // decrypt and the person logs in again; nothing is saved, so the next start tries the Keystore again.
    return createMMKV({ id: STORAGE_ID, encryptionKey: claveNueva() })
  }
  // No key yet (update or fresh install): open with the old key and move the file to a new one.
  const almacen = createMMKV({ id: STORAGE_ID, encryptionKey: LEGACY_MIGRATION_ONLY_KEY })
  const nueva = claveNueva()
  // The key is saved first: re-encrypting with a key that is not saved would lose the file at the next start.
  // Not saved: this run keeps the old key and the next start retries.
  if (!guardarClave(nueva)) return almacen
  try {
    almacen.recrypt(nueva)
  } catch {
    // The file still has the old key: forget the new one so the next start migrates again.
    // Starting the app never fails here, not even when the delete itself throws.
    try {
      void SecureStore.deleteItemAsync(STORAGE_KEY_NAME).catch(() => {})
    } catch {
      // Left saved: the next start opens with it and the old data does not decrypt (fail-closed, as an unreadable Keystore).
    }
  }
  return almacen
}

export const storage = abrirAlmacen()

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
