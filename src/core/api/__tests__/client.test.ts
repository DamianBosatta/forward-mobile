import { api, ApiError } from '@/core/api/client'

jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

const mockFetch = jest.fn()
const responder = (status: number, body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
const fallo = (p: Promise<unknown>) => p.then(() => { throw new Error('no falló') }, (e: unknown) => e as ApiError)

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

// Sobre de error del servidor (Response<T>): ventas/409 con clave de idempotencia ya usada y otro cuerpo.
const SOBRE_409 = {
  statusCode: 409, succeeded: false, message: 'Esta clave de idempotencia ya se usó para grabar otro pedido.',
  traceId: 't1', errors: [], codigo: 'ClaveIdempotenciaConOtroCuerpo', data: { ventaId: 'v9', version: 3, message: 'x' },
}

describe('ApiError: código y datos del sobre', () => {
  it('un 409 HTTP con sobre trae el código estable y la venta de data', async () => {
    responder(409, SOBRE_409)
    const e = await fallo(api.post('/api/v1/Ventas', {}))
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(409)
    expect(e.codigo).toBe('ClaveIdempotenciaConOtroCuerpo')
    expect(e.data).toEqual({ ventaId: 'v9', version: 3, message: 'x' })
  })

  it('un sobre succeeded:false con HTTP 200 también trae código y datos', async () => {
    responder(200, SOBRE_409)
    const e = await fallo(api.post('/api/v1/Ventas', {}))
    expect(e.status).toBe(409)
    expect(e.codigo).toBe('ClaveIdempotenciaConOtroCuerpo')
    expect(e.data).toEqual({ ventaId: 'v9', version: 3, message: 'x' })
  })

  it('sin código en el sobre (o sin sobre) quedan vacíos y el resto sigue igual', async () => {
    responder(409, { statusCode: 409, succeeded: false, message: 'La clave ya existe.', errors: ['detalle'] })
    const e = await fallo(api.post('/api/v1/Ventas', {}))
    expect(e).toMatchObject({ status: 409, message: 'La clave ya existe.', errors: ['detalle'] })
    expect(e.codigo).toBeUndefined()
    expect(e.data).toBeUndefined()
    responder(500, 'no es json de sobre')
    const e2 = await fallo(api.get('/x'))
    expect(e2).toMatchObject({ status: 500, codigo: undefined, data: undefined })
  })
})
