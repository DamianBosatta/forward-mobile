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
