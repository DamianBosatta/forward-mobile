import { comprobarVersion } from '../comprobarVersion'

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
const sobre = (versionMinima: unknown) => ({ statusCode: 200, succeeded: true, data: { versionMinima } })

jest.mock('@/src/core/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('comprobarVersion (OPS-03)', () => {
  it('pide el endpoint anónimo, sin Authorization', async () => {
    responder(200, sobre('1.4.0'))
    await comprobarVersion('1.0.0')
    const [url, opciones] = mockFetch.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/AppMovil\/version-minima$/)
    expect(new Headers(opciones.headers).has('Authorization')).toBe(false)
  })

  it('una versión instalada menor bloquea y trae la mínima', async () => {
    responder(200, sobre('1.4.0'))
    expect(await comprobarVersion('1.0.0')).toEqual({ bloquea: true, minima: '1.4.0' })
  })

  it.each(['1.4.0', '2.0.0'])('la instalada igual o mayor (%s) deja pasar', async (instalada) => {
    responder(200, sobre('1.4.0'))
    expect((await comprobarVersion(instalada)).bloquea).toBe(false)
  })

  it('null no bloquea', async () => {
    responder(200, sobre(null))
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
  })

  it('un 404 (servidor viejo sin el endpoint) no bloquea', async () => {
    responder(404, { statusCode: 404, succeeded: false, message: 'no existe' })
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
  })

  it('un 500 no bloquea', async () => {
    responder(500, 'boom')
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
  })

  it('un error de red no bloquea', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
  })

  it('un valor inválido o un cuerpo raro no bloquea', async () => {
    responder(200, sobre('no es version'))
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
    responder(200, sobre(42))
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
    responder(200, { algo: 'distinto' })
    expect((await comprobarVersion('1.0.0')).bloquea).toBe(false)
  })

  it('sin versión instalada legible no pregunta ni bloquea', async () => {
    expect((await comprobarVersion(null)).bloquea).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
