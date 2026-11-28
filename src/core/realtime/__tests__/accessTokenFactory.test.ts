jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

jest.mock('@microsoft/signalr', () => {
  const b: Record<string, jest.Mock> = {}
  b.withUrl = jest.fn().mockReturnValue(b)
  b.withAutomaticReconnect = jest.fn().mockReturnValue(b)
  b.configureLogging = jest.fn().mockReturnValue(b)
  b.build = jest.fn().mockReturnValue({})
  return { __b: b, HubConnectionBuilder: jest.fn(() => b), HttpTransportType: {}, LogLevel: { None: 0 } }
})

import { configureApiClient } from '@/core/api/client'
import { conexionReal } from '../stockEnVivo'

const mockWithUrl = (jest.requireMock('@microsoft/signalr') as { __b: { withUrl: jest.Mock } }).__b.withUrl

const jwtConExp = (expSeg: number) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none' })}.${b64({ exp: expSeg })}.firma`
}

describe('conexión real al hub de stock: token de cada negociación', () => {
  it('el accessTokenFactory renueva un token vencido antes de devolverlo (el reintento tras el cierre por vencimiento)', async () => {
    const nuevo = jwtConExp(Math.floor(Date.now() / 1000) + 3600)
    let token = jwtConExp(Math.floor(Date.now() / 1000) - 10)
    configureApiClient({
      getToken: () => token, getRefreshToken: () => 'r1',
      onTokensRefreshed: (t) => { token = t.accessToken }, onUnauthorized: jest.fn(),
    })
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ access_token: nuevo, refresh_token: 'r2' }) })
    global.fetch = fetchMock as unknown as typeof fetch

    conexionReal()
    const { accessTokenFactory } = mockWithUrl.mock.calls[0][1] as { accessTokenFactory: () => Promise<string> | string }

    await expect(accessTokenFactory()).resolves.toBe(nuevo)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
