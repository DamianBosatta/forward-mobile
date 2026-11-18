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
jest.mock('@/libs/store/auth.store', () => ({
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
}))

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
