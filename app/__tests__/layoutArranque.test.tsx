// Start-up wiring of app/_layout.tsx: the legacy fingerprint credential is cleaned on the first start.
const mockStore = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockStore.set(k, v) }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k) }),
  AFTER_FIRST_UNLOCK: 'after-first-unlock',
  WHEN_UNLOCKED: 'when-unlocked',
}))
jest.mock('expo-local-authentication', () => ({}))
jest.mock('../../global.css', () => ({}))

// Importing the whole root layout is slow the first time.
jest.setTimeout(60_000)

const CREDENCIAL = 'forward_biometric_credentials'
const MARCA = 'forward_biometric_saved'

const arrancar = async () => {
  jest.isolateModules(() => {
    require('../_layout')
  })
  await new Promise((r) => setImmediate(r))
}

describe('app start', () => {
  beforeEach(() => mockStore.clear())

  it('deletes a legacy fingerprint credential that has no saved marker', async () => {
    mockStore.set(CREDENCIAL, JSON.stringify({ username: 'a', password: 'b' }))
    await arrancar()
    expect(mockStore.has(CREDENCIAL)).toBe(false)
  })

  it('keeps a fingerprint credential saved with its marker', async () => {
    mockStore.set(CREDENCIAL, JSON.stringify({ username: 'a', password: 'b' }))
    mockStore.set(MARCA, 'true')
    await arrancar()
    expect(mockStore.has(CREDENCIAL)).toBe(true)
  })
})
