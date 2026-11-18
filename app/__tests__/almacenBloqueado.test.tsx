/**
 * SEG-01 (re-audit 3): when the Keystore cannot give the storage key, the app does not start on a throwaway key. It
 * shows a recovery screen, hides the splash itself and reports the failure to Sentry without the key.
 * Recovery (owner decision 2026-11-18, "Pantalla de recuperación"): the screen says what happened and what is lost,
 * keeps Reintentar, and offers Empezar de nuevo, which wipes nothing until the person confirms it.
 * Only the native edges are mocked: SecureStore, the MMKV constructor, the splash, the reload and Sentry.
 */
import type * as RNTL from '@testing-library/react-native'

// Each test loads the testing library in its own module registry (below): its automatic afterEach cannot be
// registered from inside a test, so the cleanup of the last render runs in this file's afterEach.
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true'
let limpiar: (() => void) | null = null
afterEach(() => {
  limpiar?.()
  limpiar = null
})

const CLAVE_GUARDADA = 'abcdefghijklmnop'
const mockSecure = new Map<string, string>([['forward_mmkv_key', CLAVE_GUARDADA]])
const mockGetItem = jest.fn((k: string): string | null => mockSecure.get(k) ?? null)
const mockSetItem = jest.fn((k: string, v: string) => { mockSecure.set(k, v) })
const mockDeleteItemAsync = jest.fn(async (_k: string) => undefined)
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItem: (k: string) => mockGetItem(k),
  setItem: (k: string, v: string) => mockSetItem(k, v),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: (k: string) => mockDeleteItemAsync(k),
}))
const mockCreateMMKV = jest.fn((_config: { id: string; encryptionKey?: string }) => {
  const datos = new Map<string, string>()
  return {
    set: (k: string, v: string) => { datos.set(k, v) },
    getString: (k: string) => datos.get(k),
    remove: (k: string) => datos.delete(k),
    recrypt: jest.fn(),
  }
})
const mockDeleteMMKV = jest.fn((_id: string) => true)
jest.mock('react-native-mmkv', () => ({
  createMMKV: (c: { id: string; encryptionKey?: string }) => mockCreateMMKV(c),
  existsMMKV: () => true,
  deleteMMKV: (id: string) => mockDeleteMMKV(id),
}))
const mockHideAsync = jest.fn(async () => undefined)
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(async () => undefined), hideAsync: () => mockHideAsync() }))
const mockReloadAsync = jest.fn(async () => undefined)
jest.mock('expo-updates', () => ({ reloadAsync: () => mockReloadAsync() }))
const mockCaptureException = jest.fn()
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c: unknown) => c,
  captureException: (e: unknown) => mockCaptureException(e),
  captureMessage: jest.fn(),
}))
jest.mock('expo-local-authentication', () => ({}))
jest.mock('../../global.css', () => ({}))

// Importing the whole root layout is slow the first time.
jest.setTimeout(60_000)

const TITULO = 'No pudimos abrir lo guardado en el teléfono'
const CONFIRMACION = '¿Empezar de nuevo?'

/** A fresh app start: React, the testing library and the layout come from one new module registry. */
function arrancarConElKeystoreRoto(tema: 'light' | 'dark' = 'light'): Pick<typeof RNTL, 'screen' | 'userEvent'> {
  mockGetItem.mockImplementation(() => { throw new Error('Keystore unavailable') })
  jest.resetModules()
  const React = require('react') as typeof import('react')
  const rntl = require('@testing-library/react-native') as typeof RNTL
  const Layout = require('../_layout').default as React.ComponentType
  const { useThemeStore } = require('@/libs/theme') as typeof import('@/libs/theme')
  useThemeStore.setState({ mode: tema })
  rntl.render(React.createElement(Layout))
  limpiar = rntl.cleanup
  return rntl
}

/** A Keystore whose old entry no longer decrypts (screen lock changed): reads throw until a new key is written. */
function keystoreQueAceptaUnaClaveNueva() {
  let invalidado = true
  mockGetItem.mockImplementation((k: string) => {
    if (invalidado) throw new Error('KeyPermanentlyInvalidatedException')
    return mockSecure.get(k) ?? null
  })
  mockSetItem.mockImplementation((k: string, v: string) => {
    mockSecure.set(k, v)
    invalidado = false
  })
}

const abiertoElArchivo = () => mockCreateMMKV.mock.calls.some((c) => c[0].id === 'forward-app-storage')
/** Only a logout deletes who took the fingerprint decision (`forgetBiometricLogin`); app start deletes other entries. */
const borradosDeSecureStore = () => mockDeleteItemAsync.mock.calls.map((c) => c[0])
const cerroLaSesion = () => borradosDeSecureStore().includes('forward_biometric_user')
const seTocoAlgo = () =>
  mockDeleteMMKV.mock.calls.length > 0 ||
  mockSetItem.mock.calls.length > 0 ||
  cerroLaSesion() ||
  borradosDeSecureStore().includes('forward_mmkv_key')

async function empezarDeNuevoYConfirmar({ screen, userEvent }: Pick<typeof RNTL, 'screen' | 'userEvent'>) {
  await userEvent.press(await screen.findByRole('button', { name: 'Empezar de nuevo' }))
  await userEvent.press(screen.getByRole('button', { name: 'Borrar y empezar' }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSecure.clear()
  mockSecure.set('forward_mmkv_key', CLAVE_GUARDADA)
  mockSetItem.mockImplementation((k: string, v: string) => { mockSecure.set(k, v) })
})

describe.each(['light', 'dark'] as const)('recovery screen (%s)', (tema) => {
  it('says what happened and what is lost, and offers Empezar de nuevo and Reintentar', async () => {
    const { screen } = arrancarConElKeystoreRoto(tema)
    const titulo = await screen.findByRole('header', { name: TITULO })
    const { StyleSheet } = require('react-native') as typeof import('react-native')
    const { themeColors } = require('@/libs/theme') as typeof import('@/libs/theme')
    expect(StyleSheet.flatten(titulo.props.style).color).toBe(themeColors[tema].text)
    expect(screen.getByText(/copia de seguridad/)).toBeTruthy()
    expect(screen.getByText(/bloqueo de pantalla/)).toBeTruthy()
    // The number of pending operations cannot be read without the key: the generic loss message.
    expect(screen.getByText(/todavía no se envió al servidor se pierde/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Empezar de nuevo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})

describe('app start with an unreadable storage key', () => {
  it('shows the recovery screen, hides the splash and reports once without the key; the file is never opened', async () => {
    const { screen } = arrancarConElKeystoreRoto()
    expect(await screen.findByRole('header', { name: TITULO })).toBeTruthy()
    expect(mockHideAsync).toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain(CLAVE_GUARDADA)
    expect(String(mockCaptureException.mock.calls[0][0])).toContain('keystore-ilegible')
    expect(abiertoElArchivo()).toBe(false)
    expect(seTocoAlgo()).toBe(false)
  })

  it('Reintentar while the Keystore still fails keeps the screen, says so and does not reload', async () => {
    const { screen, userEvent } = arrancarConElKeystoreRoto()
    await userEvent.press(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('header', { name: TITULO })).toBeTruthy()
    expect(screen.getByText(/Todavía no se pudo/)).toBeTruthy()
    expect(mockReloadAsync).not.toHaveBeenCalled()
    expect(abiertoElArchivo()).toBe(false)
  })

  it('Reintentar once the Keystore answers reloads the app and writes no new key (the reload opens the file: storage.test.ts)', async () => {
    const { screen, userEvent } = arrancarConElKeystoreRoto()
    mockGetItem.mockImplementation((k: string) => mockSecure.get(k) ?? null)
    await userEvent.press(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(mockReloadAsync).toHaveBeenCalledTimes(1)
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(mockSecure.get('forward_mmkv_key')).toBe(CLAVE_GUARDADA)
  })

  it('Reintentar when the reload rejects says it did not work and reports the reason, never the key', async () => {
    const { screen, userEvent } = arrancarConElKeystoreRoto()
    mockGetItem.mockImplementation((k: string) => mockSecure.get(k) ?? null)
    mockReloadAsync.mockRejectedValueOnce(new Error('reload failed'))
    await userEvent.press(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(/Todavía no se pudo/)).toBeTruthy()
    expect(mockCaptureException).toHaveBeenCalledTimes(2)
    expect(String(mockCaptureException.mock.calls[1][0])).toContain('reload failed')
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain(CLAVE_GUARDADA)
  })
})

describe('Empezar de nuevo', () => {
  it('only asks: Cancelar closes the question and nothing is wiped', async () => {
    const { screen, userEvent } = arrancarConElKeystoreRoto()
    await userEvent.press(await screen.findByRole('button', { name: 'Empezar de nuevo' }))
    expect(screen.getByText(CONFIRMACION)).toBeTruthy()
    expect(seTocoAlgo()).toBe(false)

    await userEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(CONFIRMACION)).toBeNull()
    expect(seTocoAlgo()).toBe(false)
    expect(mockReloadAsync).not.toHaveBeenCalled()
    expect(mockSecure.get('forward_mmkv_key')).toBe(CLAVE_GUARDADA)
  })

  it('confirmed: saves a new key, deletes the file, closes the session and reloads the app on the login', async () => {
    const rntl = arrancarConElKeystoreRoto()
    keystoreQueAceptaUnaClaveNueva()
    await empezarDeNuevoYConfirmar(rntl)

    const nueva = mockSecure.get('forward_mmkv_key')
    expect(nueva).toMatch(/^[A-Za-z0-9+/]{16}$/)
    expect(nueva).not.toBe(CLAVE_GUARDADA)
    expect(mockDeleteMMKV).toHaveBeenCalledWith('forward-app-storage')
    expect(mockSetItem.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteMMKV.mock.invocationCallOrder[0])
    // The forced logout (`cerrarSesion`) runs after the reset: it forgets the fingerprint, never the storage key.
    const logout = borradosDeSecureStore().indexOf('forward_biometric_user')
    expect(logout).toBeGreaterThanOrEqual(0)
    expect(mockDeleteItemAsync.mock.invocationCallOrder[logout]).toBeGreaterThan(mockDeleteMMKV.mock.invocationCallOrder[0])
    expect(borradosDeSecureStore()).not.toContain('forward_mmkv_key')
    // The reloaded app opens an empty file with the new key, so nobody is logged in (storage.test.ts).
    expect(mockReloadAsync).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain(nueva)
  })

  it('confirmed, when the Keystore does not take a new key: wipes nothing, keeps the session and says so', async () => {
    const rntl = arrancarConElKeystoreRoto()
    mockSetItem.mockImplementation(() => { throw new Error('Keystore unavailable') })
    await empezarDeNuevoYConfirmar(rntl)

    expect(await rntl.screen.findByText(/No se borró nada/)).toBeTruthy()
    expect(mockDeleteMMKV).not.toHaveBeenCalled()
    expect(cerroLaSesion()).toBe(false)
    expect(mockReloadAsync).not.toHaveBeenCalled()
    expect(mockSecure.get('forward_mmkv_key')).toBe(CLAVE_GUARDADA)
  })

  it('confirmed, when the new key is saved but does not read back: deletes no file, does not reload and says so', async () => {
    const rntl = arrancarConElKeystoreRoto()
    await empezarDeNuevoYConfirmar(rntl)

    expect(await rntl.screen.findByText(/no deja leer la clave nueva/)).toBeTruthy()
    expect(mockDeleteMMKV).not.toHaveBeenCalled()
    expect(cerroLaSesion()).toBe(false)
    expect(mockReloadAsync).not.toHaveBeenCalled()
  })

  it('confirmed, when the saved key reads again: wipes nothing, does not log out and reloads with the data', async () => {
    const rntl = arrancarConElKeystoreRoto()
    mockGetItem.mockImplementation((k: string) => mockSecure.get(k) ?? null)
    await empezarDeNuevoYConfirmar(rntl)

    expect(mockReloadAsync).toHaveBeenCalledTimes(1)
    expect(seTocoAlgo()).toBe(false)
    expect(mockSecure.get('forward_mmkv_key')).toBe(CLAVE_GUARDADA)
  })

  it('when the reload fails after the reset, it asks to reopen the app and no longer offers to wipe', async () => {
    const rntl = arrancarConElKeystoreRoto()
    keystoreQueAceptaUnaClaveNueva()
    mockReloadAsync.mockRejectedValueOnce(new Error('reload failed'))
    await empezarDeNuevoYConfirmar(rntl)

    expect(await rntl.screen.findByText(/Cerrá la app y volvé a abrirla/)).toBeTruthy()
    expect(rntl.screen.queryByRole('button', { name: 'Empezar de nuevo' })).toBeNull()
    expect(mockDeleteMMKV).toHaveBeenCalledTimes(1)
  })
})
