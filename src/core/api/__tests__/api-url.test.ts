jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))
jest.mock('@/src/core/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const RETIRED_DEV = 'https://api-dev.forward-gestion.com.ar:8443'

function apiUrlWithEnv(value: string | undefined): string {
  const previous = process.env.EXPO_PUBLIC_API_URL
  if (value === undefined) delete process.env.EXPO_PUBLIC_API_URL
  else process.env.EXPO_PUBLIC_API_URL = value
  try {
    let url = ''
    jest.isolateModules(() => {
      url = require('@/core/api/client').API_URL
    })
    return url
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL
    else process.env.EXPO_PUBLIC_API_URL = previous
  }
}

describe('initial API_URL', () => {
  it('a build env pointing to the retired dev server falls back to production', () => {
    expect(apiUrlWithEnv(RETIRED_DEV)).toBe('https://api.forward-gestion.com.ar')
  })

  it('any other build env is kept', () => {
    expect(apiUrlWithEnv('http://10.0.2.2:5000')).toBe('http://10.0.2.2:5000')
  })

  it('without a build env it is production', () => {
    expect(apiUrlWithEnv(undefined)).toBe('https://api.forward-gestion.com.ar')
  })
})

// SEG-05: only a dev build lets the person pick the server (the selector is behind __DEV__), so only a dev build
// may read the saved one back. A phone that had the dev client with "Local" chosen and then got the store APK
// (same package) must not keep pointing at that server.
describe('saved API_URL (SEG-05)', () => {
  const SAVED = 'http://10.0.2.2:5000'
  const devAntes = (global as { __DEV__?: boolean }).__DEV__

  // The client and the storage it reads come from the same isolated registry, so the saved value is the one it sees.
  async function loadWith(dev: boolean): Promise<{ url: string; guardada: string | null }> {
    ;(global as { __DEV__?: boolean }).__DEV__ = dev
    delete process.env.EXPO_PUBLIC_API_URL
    let load: () => Promise<string> = async () => ''
    let storage = { setItem: async (_k: string, _v: string) => {}, getItem: async (_k: string): Promise<string | null> => null }
    jest.isolateModules(() => {
      storage = require('@react-native-async-storage/async-storage')
      load = require('@/core/api/client').loadSavedApiUrl
    })
    await storage.setItem('forward_api_url', SAVED)
    const url = await load()
    return { url, guardada: await storage.getItem('forward_api_url') }
  }

  afterEach(() => {
    ;(global as { __DEV__?: boolean }).__DEV__ = devAntes
  })

  it('a release build ignores the saved URL and deletes it', async () => {
    await expect(loadWith(false)).resolves.toEqual({ url: 'https://api.forward-gestion.com.ar', guardada: null })
  })

  it('a dev build keeps using the saved URL', async () => {
    await expect(loadWith(true)).resolves.toEqual({ url: SAVED, guardada: SAVED })
  })
})
