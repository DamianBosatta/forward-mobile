/**
 * sharePdf unit tests (light) — mocks expo-file-system, expo-sharing, fetch.
 * Verifies: auth header sent, isAvailableAsync guard, reason mapping.
 */

import { sharePdf } from '../sharePdf'
import { configureApiClient } from '@/core/api/client'

jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock auth store — default: token present
const mockAccessToken: { value: string | null } = { value: 'test-jwt-token' }
jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: mockAccessToken.value }),
  },
}))

// Mock expo-file-system/legacy (SDK 54 split the API; legacy has cacheDirectory, writeAsStringAsync, etc.)
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: (...a: unknown[]) => mockCreateDownload(...a),
}))

const mockCreateDownload = jest.fn()

// Mock expo-sharing
const mockIsAvailable = jest.fn().mockResolvedValue(true)
const mockShareAsync = jest.fn().mockResolvedValue(undefined)
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailable(),
  shareAsync: (...args: any[]) => mockShareAsync(...args),
}))

// Mock FileReader (used inside sharePdf for blob → base64 conversion)
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(function (this: any) {
    this.result = 'data:application/pdf;base64,JVBERi0xLjQ='
    this.onloadend?.()
  }),
  onloadend: null,
  onerror: null,
  result: '',
})) as any

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// ── Helpers ─────────────────────────────────────────────────────────────────────

function makeMockBlob() {
  return { size: 100, type: 'application/pdf' }
}

function makeOkResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: jest.fn().mockResolvedValue(makeMockBlob()),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockAccessToken.value = 'test-jwt-token'
  configureApiClient({
    getToken: () => mockAccessToken.value,
    getRefreshToken: () => null,
    onTokensRefreshed: jest.fn(),
    onUnauthorized: jest.fn(),
  })
  mockIsAvailable.mockResolvedValue(true)
  mockShareAsync.mockResolvedValue(undefined)
})

describe('sharePdf — Authorization header', () => {
  it('sends Authorization: Bearer <token> in the fetch request', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.com/pdf')
    expect(new Headers(mockFetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer test-jwt-token')
  })
})

describe('sharePdf — isAvailableAsync guard', () => {
  it('returns { ok: false, reason: "unavailable" } when sharing is not available', async () => {
    mockIsAvailable.mockResolvedValueOnce(false)
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'unavailable' }),
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('sharePdf — 401 auth error', () => {
  it('returns { ok: false, reason: "auth" } on 401 response', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(401))
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'auth' }),
    )
  })

  it('returns { ok: false, reason: "auth" } on 403 response', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(403))
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'auth' }),
    )
  })
})

describe('sharePdf — HTTP error status', () => {
  it('returns the HTTP status so callers can branch on it (404)', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(404))
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'network', status: 404, message: 'Error al descargar el archivo (404).' }),
    )
  })
})

describe('sharePdf — network error', () => {
  it('returns { ok: false, reason: "network" } when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'))
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'network' }),
    )
  })
})

describe('sharePdf — no auth token', () => {
  it('returns { ok: false, reason: "auth" } when accessToken is null', async () => {
    mockAccessToken.value = null
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'auth' }),
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('sharePdf — success path', () => {
  it('returns { ok: true } and calls shareAsync on success', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual({ ok: true })
    expect(mockShareAsync).toHaveBeenCalledWith(
      expect.stringContaining('test.pdf'),
      expect.objectContaining({ mimeType: 'application/pdf' }),
    )
  })

  it('shares an .xlsx file with the spreadsheet mime type and UTI', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    const result = await sharePdf('https://api.example.com/export', 'estado-cuenta.xlsx')
    expect(result).toEqual({ ok: true })
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/estado-cuenta.xlsx', {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    })
  })

  it('keeps the PDF mime type and UTI for .pdf files', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/test.pdf', { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
  })
})

describe('sharePdf — 401 refresh (M10a)', () => {
  it('with an expired token refreshes once and retries the download with the new token', async () => {
    let token = 'vencido'
    configureApiClient({
      getToken: () => token,
      getRefreshToken: () => 'refresh-1',
      onTokensRefreshed: (t) => { token = t.accessToken },
      onUnauthorized: jest.fn(),
    })
    mockAccessToken.value = 'vencido'
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(401))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'nuevo', refresh_token: 'refresh-2' }) })
      .mockResolvedValueOnce(makeOkResponse())

    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockFetch.mock.calls[1][0]).toContain('/connect/token')
    expect(mockFetch.mock.calls[2][0]).toBe('https://api.example.com/pdf')
    expect(new Headers(mockFetch.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer nuevo')
    expect(mockShareAsync).toHaveBeenCalledTimes(1)
  })
})

describe('sharePdf — plazo de la descarga', () => {
  /** Un fetch que responde a los `ms` y se corta si se aborta la señal (como el de React Native). */
  const fetchLento = (ms: number) => (_url: string, init: RequestInit = {}) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve(makeOkResponse()), ms)
      init.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      })
    })

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('una descarga de 20 s (más que los 15 s de un request común) llega y se comparte', async () => {
    mockFetch.mockImplementationOnce(fetchLento(20_000))
    const enCurso = sharePdf('https://api.example.com/pdf', 'test.pdf')
    await jest.advanceTimersByTimeAsync(20_000)
    expect(await enCurso).toEqual(expect.objectContaining({ ok: true }))
  })

  it('si la descarga pasa de 120 s dice que tardó demasiado, no que no hay conexión', async () => {
    mockFetch.mockImplementationOnce(fetchLento(500_000))
    const enCurso = sharePdf('https://api.example.com/pdf', 'test.pdf')
    await jest.advanceTimersByTimeAsync(120_000)
    expect(await enCurso).toEqual({ ok: false, reason: 'network', message: 'La descarga tardó demasiado. Probá de nuevo.' })
  })

  it('sin red sigue diciendo que no se pudo conectar', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    const r = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(r).toEqual(expect.objectContaining({ ok: false, message: 'No se pudo conectar al servidor. Verificá tu conexión.' }))
  })
})


describe('sharePdf — default path pinned (no options): 11 callers rely on it', () => {
  it('goes through fetch, writes base64 to the cache and shares it, never touching the resumable download', async () => {
    const FS = jest.requireMock('expo-file-system/legacy') as { writeAsStringAsync: jest.Mock; deleteAsync: jest.Mock }
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    const result = await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][1].method).toBe('GET')
    expect(FS.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/test.pdf', 'JVBERi0xLjQ=', { encoding: 'base64' })
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/test.pdf', { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
    expect(FS.deleteAsync).toHaveBeenCalledWith('file:///cache/test.pdf', { idempotent: true })
    expect(mockCreateDownload).not.toHaveBeenCalled()
  })
})

describe('sharePdf — download with progress and cancel', () => {
  const FS = () => jest.requireMock('expo-file-system/legacy') as { deleteAsync: jest.Mock; writeAsStringAsync: jest.Mock }
  type Cb = (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void
  /** A resumable download whose `downloadAsync` is driven by the test. */
  function descarga(respuestas: Array<{ status: number } | Error | 'colgada'>) {
    const cancelAsync = jest.fn().mockResolvedValue(undefined)
    let soltar: () => void = () => {}
    mockCreateDownload.mockImplementation(() => {
      const r = respuestas.shift()
      return {
        cancelAsync,
        downloadAsync: () => {
          if (r === 'colgada') return new Promise((res) => { soltar = () => res(undefined) })
          if (r instanceof Error) return Promise.reject(r)
          return Promise.resolve({ status: r!.status, uri: 'file:///cache/c.pdf', headers: {} })
        },
      }
    })
    return { cancelAsync, soltar: () => soltar() }
  }

  it('reports written/total, sends the Bearer header and shares the file', async () => {
    descarga([{ status: 200 }])
    const onProgress = jest.fn()
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress })
    expect(r).toEqual({ ok: true })
    expect(mockFetch).not.toHaveBeenCalled()
    const [url, uri, opts, cb] = mockCreateDownload.mock.calls[0] as [string, string, { headers: Record<string, string> }, Cb]
    expect(url).toBe('https://api.example.com/pdf')
    expect(uri).toBe('file:///cache/c.pdf')
    expect(opts.headers.Authorization).toBe('Bearer test-jwt-token')
    cb({ totalBytesWritten: 50, totalBytesExpectedToWrite: 200 })
    expect(onProgress).toHaveBeenCalledWith({ written: 50, total: 200 })
    cb({ totalBytesWritten: 70, totalBytesExpectedToWrite: -1 })
    expect(onProgress).toHaveBeenLastCalledWith({ written: 70, total: 0 })
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
  })

  it('cancel returns reason cancelled, cancels the download, removes the partial file and never opens the share sheet', async () => {
    const d = descarga(['colgada'])
    const ac = new AbortController()
    const p = sharePdf('https://api.example.com/pdf', 'c.pdf', { signal: ac.signal })
    await new Promise((r) => setImmediate(r))
    ac.abort()
    await new Promise((r) => setImmediate(r))
    d.soltar()
    const r = await p
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'cancelled' }))
    expect(d.cancelAsync).toHaveBeenCalled()
    expect(FS().deleteAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { idempotent: true })
    expect(mockShareAsync).not.toHaveBeenCalled()
  })

  it('an already aborted signal does not start the download', async () => {
    descarga([{ status: 200 }])
    const ac = new AbortController()
    ac.abort()
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { signal: ac.signal })
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'cancelled' }))
    expect(mockShareAsync).not.toHaveBeenCalled()
  })

  it('a non-2xx status other than 401 is an error with its status and the file is removed', async () => {
    descarga([{ status: 500 }])
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'network', status: 500 }))
    expect(FS().deleteAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { idempotent: true })
    expect(mockShareAsync).not.toHaveBeenCalled()
  })

  it('a download that throws is a network error', async () => {
    descarga([new Error('boom')])
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'network' }))
  })

  it('on 401 renews the token once (shared mutex) and retries once with the new token', async () => {
    let token = 'vencido'
    configureApiClient({
      getToken: () => token,
      getRefreshToken: () => 'refresh-1',
      onTokensRefreshed: (t) => { token = t.accessToken },
      onUnauthorized: jest.fn(),
    })
    mockAccessToken.value = 'vencido'
    descarga([{ status: 401 }, { status: 200 }])
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'nuevo', refresh_token: 'refresh-2' }) })
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual({ ok: true })
    expect(mockCreateDownload).toHaveBeenCalledTimes(2)
    expect(mockCreateDownload.mock.calls[1][2].headers.Authorization).toBe('Bearer nuevo')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('/connect/token')
  })

  it('a second 401 after the renewal is an auth error: no loop', async () => {
    configureApiClient({
      getToken: () => 'x',
      getRefreshToken: () => 'refresh-1',
      onTokensRefreshed: jest.fn(),
      onUnauthorized: jest.fn(),
    })
    descarga([{ status: 401 }, { status: 401 }])
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'n', refresh_token: 'r' }) })
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'auth' }))
    expect(mockCreateDownload).toHaveBeenCalledTimes(2)
  })

  it('a cancel while the token is being renewed stops the retry: no second download, result cancelled', async () => {
    const onUnauthorized = jest.fn()
    configureApiClient({
      getToken: () => 'vencido',
      getRefreshToken: () => 'refresh-1',
      onTokensRefreshed: jest.fn(),
      onUnauthorized,
    })
    descarga([{ status: 401 }, { status: 200 }])
    let terminarRenovacion: () => void = () => {}
    mockFetch.mockReturnValueOnce(
      new Promise((res) => {
        terminarRenovacion = () => res({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'nuevo', refresh_token: 'r2' }) })
      }),
    )
    const ac = new AbortController()
    const onProgress = jest.fn()
    const p = sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress, signal: ac.signal })
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    expect(mockFetch).toHaveBeenCalledTimes(1) // the renewal is in flight
    ac.abort()
    terminarRenovacion()
    const r = await p
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'cancelled' }))
    expect(mockCreateDownload).toHaveBeenCalledTimes(1)
    expect(onProgress).not.toHaveBeenCalled()
    expect(FS().deleteAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { idempotent: true })
    expect(mockShareAsync).not.toHaveBeenCalled()
  })

  it('a failed renewal is an auth error, signs out through attemptRefresh and does not retry', async () => {
    const onUnauthorized = jest.fn()
    configureApiClient({
      getToken: () => 'vencido',
      getRefreshToken: () => 'refresh-1',
      onTokensRefreshed: jest.fn(),
      onUnauthorized,
    })
    descarga([{ status: 401 }, { status: 200 }])
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({}) })
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual({ ok: false, reason: 'auth', message: 'Sesión expirada. Por favor, volvé a iniciar sesión.' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(mockCreateDownload).toHaveBeenCalledTimes(1)
    expect(FS().deleteAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { idempotent: true })
    expect(mockShareAsync).not.toHaveBeenCalled()
  })

  it('a 403 is an auth error and the file is removed', async () => {
    descarga([{ status: 403 }])
    const r = await sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'auth' }))
    expect(mockCreateDownload).toHaveBeenCalledTimes(1)
    expect(FS().deleteAsync).toHaveBeenCalledWith('file:///cache/c.pdf', { idempotent: true })
  })

  it('times out like the fetch path (120 s) with the same message', async () => {
    jest.useFakeTimers()
    try {
      const d = descarga(['colgada'])
      const p = sharePdf('https://api.example.com/pdf', 'c.pdf', { onProgress: jest.fn() })
      await jest.advanceTimersByTimeAsync(120_001)
      d.soltar()
      const r = await p
      expect(r).toEqual({ ok: false, reason: 'network', message: 'La descarga tardó demasiado. Probá de nuevo.' })
      expect(d.cancelAsync).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
})
