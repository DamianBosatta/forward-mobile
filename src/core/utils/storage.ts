import { getRandomBytes } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createMMKV, deleteMMKV, existsMMKV, type MMKV } from 'react-native-mmkv'

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
 *
 * SEG-01 (re-audit 3): MMKV discards a file opened with the wrong key, and every offline queue lives in this file.
 * So a Keystore that cannot be read, or that answers "no key" after a key was saved, never opens the file: the app
 * blocks (`estadoDelAlmacen`) and offers Reintentar, which reloads the app once the key reads again, or Empezar de
 * nuevo (`reiniciarAlmacen`), which replaces the unreadable file with an empty one once the person confirms it.
 */
const STORAGE_ID = 'forward-app-storage'
const STORAGE_KEY_NAME = 'forward_mmkv_key'
/** Migration only: the literal key builds before audit tranche 1 encrypted the file with. Never for new data. */
const LEGACY_MIGRATION_ONLY_KEY = 'forward-mmkv-v1-3f9a8d7c2e1b6a5d'
/**
 * Plain (unencrypted) MMKV file with one non-secret fact: a per-install key was saved and the file moved to it. From
 * then on SecureStore answering "no key" is a lost key, not a first start or a pending migration. It lives outside
 * the Keystore (whose failure it must survive) and outside the encrypted file (unreadable without the key), and reads
 * synchronously before the encrypted file opens. It never holds the key or user data.
 */
const MARCAS_ID = 'forward-app-storage-marcas'
const MARCA_CLAVE_GUARDADA = 'clave-guardada'
/** Keystore reads before blocking: some Android Keystores fail one read and answer the next. */
const LECTURAS_DE_LA_CLAVE = 3

/** The part of MMKV the app and its tests use. While blocked it is a stand-in in memory that never touches the real file. */
export type Almacen = Pick<MMKV, 'getString' | 'set' | 'remove' | 'clearAll' | 'getAllKeys'>

/** Why the encrypted file was not opened: the Keystore threw on every read, or it lost a key that was saved. */
export type MotivoDeBloqueo = 'keystore-ilegible' | 'clave-perdida'
export type EstadoDelAlmacen = { bloqueado: false } | { bloqueado: true; motivo: MotivoDeBloqueo }

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

function abrirMarcas(): Almacen | null {
  try {
    return createMMKV({ id: MARCAS_ID })
  } catch {
    return null
  }
}

const marcas = abrirMarcas()

/** An unreadable marker file reads as "not saved", which is how every start behaved before the marker. */
function seGuardoUnaClave(): boolean {
  try {
    return marcas?.getString(MARCA_CLAVE_GUARDADA) === '1'
  } catch {
    return false
  }
}

function marcarClaveGuardada() {
  try {
    if (!seGuardoUnaClave()) marcas?.set(MARCA_CLAVE_GUARDADA, '1')
  } catch {
    // Not marked: the next good read marks it.
  }
}

/** Unknown reads as "exists": the old-key migration is what an existing file without a saved key needs. */
function existeElArchivo(): boolean {
  try {
    return existsMMKV(STORAGE_ID)
  } catch {
    return true
  }
}

type Plan =
  | { tipo: 'abrir'; clave: string }
  | { tipo: 'primer-arranque' }
  | { tipo: 'migrar' }
  | { tipo: 'bloquear'; motivo: MotivoDeBloqueo }

/**
 * What this start does with the encrypted file. Reads the Keystore up to `LECTURAS_DE_LA_CLAVE` times while it
 * throws, or while it answers "no key" after a key was saved. Opens and writes nothing.
 */
function planDeApertura(): Plan {
  const debeExistir = seGuardoUnaClave()
  let lectura: ClaveGuardada = { estado: 'ilegible' }
  for (let intento = 0; intento < LECTURAS_DE_LA_CLAVE; intento++) {
    lectura = leerClaveGuardada()
    if (lectura.estado === 'guardada') return { tipo: 'abrir', clave: lectura.clave }
    if (lectura.estado === 'sin-clave' && !debeExistir) break
  }
  if (lectura.estado === 'ilegible') return { tipo: 'bloquear', motivo: 'keystore-ilegible' }
  if (debeExistir) return { tipo: 'bloquear', motivo: 'clave-perdida' }
  // No key and none was ever marked: a fresh install, or a file still on the old key. Owner decision (SEG-01, gap
  // option a): a phone that moved to its own key on a build before the marker, and whose Keystore now answers
  // "no key", also lands here and migrates, as before. The marker closes that from its first good start.
  return existeElArchivo() ? { tipo: 'migrar' } : { tipo: 'primer-arranque' }
}

/** Fresh install: the file is born on a saved key. Not saved: this run uses the old key and the next start migrates. */
function abrirPorPrimeraVez(): Almacen {
  const nueva = claveNueva()
  if (!guardarClave(nueva)) return createMMKV({ id: STORAGE_ID, encryptionKey: LEGACY_MIGRATION_ONLY_KEY })
  const almacen = createMMKV({ id: STORAGE_ID, encryptionKey: nueva })
  marcarClaveGuardada()
  return almacen
}

/** A file still on the old key: open with it and move the file to a new one. */
function migrarDesdeLaClaveVieja(): Almacen {
  const almacen = createMMKV({ id: STORAGE_ID, encryptionKey: LEGACY_MIGRATION_ONLY_KEY })
  const nueva = claveNueva()
  // The key is saved first: re-encrypting with a key that is not saved would lose the file at the next start.
  // Not saved: this run keeps the old key and the next start retries.
  if (!guardarClave(nueva)) return almacen
  try {
    almacen.recrypt(nueva)
    marcarClaveGuardada()
  } catch {
    // The file still has the old key: forget the new one so the next start migrates again.
    // Starting the app never fails here, not even when the delete itself throws.
    try {
      void SecureStore.deleteItemAsync(STORAGE_KEY_NAME).catch(() => {})
    } catch {
      // Left saved: the next start opens with it and the old data does not decrypt.
    }
  }
  return almacen
}

/** While blocked: memory only, so a logout or a stray write never reaches the real file. */
function almacenEnMemoria(): Almacen {
  const datos = new Map<string, string>()
  return {
    getString: (clave) => datos.get(clave),
    set: (clave, valor) => {
      datos.set(clave, String(valor))
    },
    remove: (clave) => datos.delete(clave),
    clearAll: () => datos.clear(),
    getAllKeys: () => Array.from(datos.keys()),
  }
}

function abrirAlmacen(): { almacen: Almacen; estado: EstadoDelAlmacen } {
  const plan = planDeApertura()
  if (plan.tipo === 'bloquear') return { almacen: almacenEnMemoria(), estado: { bloqueado: true, motivo: plan.motivo } }
  if (plan.tipo === 'abrir') {
    const almacen = createMMKV({ id: STORAGE_ID, encryptionKey: plan.clave })
    // A phone that moved to its own key on a build before the marker gets it on its first good start.
    marcarClaveGuardada()
    return { almacen, estado: { bloqueado: false } }
  }
  const almacen = plan.tipo === 'primer-arranque' ? abrirPorPrimeraVez() : migrarDesdeLaClaveVieja()
  return { almacen, estado: { bloqueado: false } }
}

const apertura = abrirAlmacen()

export const storage: Almacen = apertura.almacen

/** Whether this start opened the encrypted file. Blocked, the app shows only the Reintentar screen. */
export function estadoDelAlmacen(): EstadoDelAlmacen {
  return apertura.estado
}

/**
 * Reintentar: whether the file would open now (the key reads, or there is nothing to lose). Opens and writes
 * nothing: the caller reloads the app, so every store reads the real file from the start.
 */
export function sePuedeAbrirElAlmacen(): boolean {
  return planDeApertura().tipo !== 'bloquear'
}

/**
 * What Empezar de nuevo did:
 * - `reiniciado`: a new key is saved and reads back, and the old file is deleted. The reload opens an empty file.
 * - `se-abre`: the saved key reads again, so nothing was written or deleted: the reload opens the file with its data.
 * - `sin-guardar`: the Keystore did not take a new key. Nothing changed.
 * - `sin-leer`: the new key was saved but does not read back. The file was not deleted, but the old key is replaced:
 *   once the Keystore answers again, the next start opens the old file with the new key and MMKV discards it.
 */
export type ResultadoDelReinicio = 'reiniciado' | 'se-abre' | 'sin-guardar' | 'sin-leer'

/** True once Empezar de nuevo deleted the file in this run: the plain copies it moved from can go too. */
let seReinicio = false

/** Reads the key back up to `LECTURAS_DE_LA_CLAVE` times, as a start does. */
function seLeeLaClave(clave: string): boolean {
  for (let intento = 0; intento < LECTURAS_DE_LA_CLAVE; intento++) {
    const lectura = leerClaveGuardada()
    if (lectura.estado === 'guardada') return lectura.clave === clave
    if (lectura.estado === 'sin-clave') return false
  }
  return false
}

/**
 * Empezar de nuevo (owner decision 2026-11-18, recovery screen), only after the person confirms it. The key is the
 * point of no return, so it is written and read back BEFORE the file is deleted: a Keystore that does not take a key
 * deletes nothing. The file is deleted without opening it. This run keeps the in-memory stand-in (and the GPS task its
 * early return): the caller closes the session and reloads the app, which opens the new empty file.
 */
export function reiniciarAlmacen(): ResultadoDelReinicio {
  // Never wipe a file that opened in this run, or one that opens now: the reload recovers it, with all the queues.
  if (!apertura.estado.bloqueado || planDeApertura().tipo !== 'bloquear') return 'se-abre'
  const nueva = claveNueva()
  if (!guardarClave(nueva)) return 'sin-guardar'
  if (!seLeeLaClave(nueva)) return 'sin-leer'
  try {
    deleteMMKV(STORAGE_ID)
  } catch {
    // Left on disk: the next start opens it with the new key and MMKV discards what it cannot decrypt.
  }
  marcarClaveGuardada()
  seReinicio = true
  return 'reiniciado'
}

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

/** Lo mínimo que se usa del almacén viejo sin cifrar (AsyncStorage) para mudar una clave. */
interface AlmacenPlano {
  getItem: (name: string) => Promise<string | null>
  removeItem: (name: string) => Promise<void>
}

/**
 * Adaptador de Zustand sobre el almacén cifrado para una clave que antes vivía en `plano` (AsyncStorage, sin cifrar).
 * Lee primero lo cifrado; si no está, lee lo viejo, lo copia al cifrado y recién entonces borra la copia plana. Toda
 * lectura con lo cifrado presente borra también la copia plana que haya quedado. Lo nuevo se escribe solo cifrado y
 * borrar borra en los dos lados (SEG-10).
 */
export function zustandStorageMudadoDesde(plano: AlmacenPlano) {
  // SEG-01: blocked, the encrypted side is a stand-in in memory. Moving the plain copy into it and removing it would
  // lose it at the next start, so the plain copy is left alone until the real file opens. After Empezar de nuevo the
  // person chose to start fresh: removing (the logout that follows) removes the plain copy too, so the reload does
  // not move an old trip into the new file.
  const bloqueado = apertura.estado.bloqueado
  return {
    getItem: (name: string): string | null | Promise<string | null> => {
      if (bloqueado) return null
      const cifrado = zustandStorage.getItem(name)
      if (cifrado !== null) {
        // Con lo cifrado ya guardado no queda copia plana: la deja una mudanza cortada o un build viejo. Si falla, la
        // próxima lectura lo reintenta; la lectura no espera a AsyncStorage.
        plano.removeItem(name).catch(() => undefined)
        return cifrado
      }
      return plano.getItem(name).then(async (viejo) => {
        if (viejo === null) return null
        zustandStorage.setItem(name, viejo)
        await plano.removeItem(name)
        return viejo
      })
    },
    setItem: (name: string, value: string) => zustandStorage.setItem(name, value),
    removeItem: async (name: string) => {
      zustandStorage.removeItem(name)
      if (!bloqueado || seReinicio) await plano.removeItem(name)
    },
  }
}
