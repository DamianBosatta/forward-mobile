/**
 * sharePdf unit tests (light) — mocks expo-file-system, expo-sharing, fetch.
 * Verifies: auth header sent, isAvailableAsync guard, reason mapping.
 */

import { sharePdf } from '../sharePdf'

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
  mockIsAvailable.mockResolvedValue(true)
  mockShareAsync.mockResolvedValue(undefined)
})

describe('sharePdf — Authorization header', () => {
  it('sends Authorization: Bearer <token> in the fetch request', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await sharePdf('https://api.example.com/pdf', 'test.pdf')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/pdf',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      }),
    )
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
})
