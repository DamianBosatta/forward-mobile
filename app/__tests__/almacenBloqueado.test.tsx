/**
 * SEG-01 (re-audit 3): when the Keystore cannot give the storage key, the app does not start on a throwaway key. It
 * shows a blocking screen with Reintentar, hides the splash itself and reports the failure to Sentry without the key.
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
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItem: (k: string) => mockGetItem(k),
  setItem: (k: string, v: string) => mockSetItem(k, v),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
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
jest.mock('react-native-mmkv', () => ({
  createMMKV: (c: { id: string; encryptionKey?: string }) => mockCreateMMKV(c),
  existsMMKV: () => true,
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

/** A fresh app start: React, the testing library and the layout come from one new module registry. */
function arrancarConElKeystoreRoto(): Pick<typeof RNTL, 'screen' | 'userEvent'> {
  mockGetItem.mockImplementation(() => { throw new Error('Keystore unavailable') })
  jest.resetModules()
  const React = require('react') as typeof import('react')
  const rntl = require('@testing-library/react-native') as typeof RNTL
  const Layout = require('../_layout').default as React.ComponentType
  rntl.render(React.createElement(Layout))
  limpiar = rntl.cleanup
  return rntl
}

const abiertoElArchivo = () => mockCreateMMKV.mock.calls.some((c) => c[0].id === 'forward-app-storage')

beforeEach(() => jest.clearAllMocks())

describe('app start with an unreadable storage key', () => {
  it('shows the blocking screen, hides the splash and reports once without the key; the file is never opened', async () => {
    const { screen } = arrancarConElKeystoreRoto()
    expect(await screen.findByRole('header', { name: TITULO })).toBeTruthy()
    expect(screen.getByText(/sigue guardado/)).toBeTruthy()
    expect(mockHideAsync).toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain(CLAVE_GUARDADA)
    expect(String(mockCaptureException.mock.calls[0][0])).toContain('keystore-ilegible')
    expect(abiertoElArchivo()).toBe(false)
    expect(mockSetItem).not.toHaveBeenCalled()
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
