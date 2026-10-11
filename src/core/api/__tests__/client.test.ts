import { api, ApiError, configureApiClient } from '@/core/api/client'

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

  it('tras un 401, el reintento con el token renovado que falla también trae código y datos', async () => {
    let token = 'viejo'
    configureApiClient({
      getToken: () => token, getRefreshToken: () => 'r1',
      onTokensRefreshed: (t) => { token = t.accessToken }, onUnauthorized: jest.fn(),
    })
    responder(401, {})
    responder(200, { access_token: 'nuevo', refresh_token: 'r2' })
    responder(409, SOBRE_409)
    const e = await fallo(api.post('/api/v1/Ventas', {}))
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(e).toMatchObject({ status: 409, codigo: 'ClaveIdempotenciaConOtroCuerpo', data: { ventaId: 'v9', version: 3, message: 'x' } })
  })
})

// Sobre de éxito con un campo al lado de `data` (forward-system #868: el cobro informa su cuenta).
const SOBRE_COBRO = { statusCode: 200, succeeded: true, message: 'Pago registrado', errors: null, data: 'p1', tipoCuenta: 'Tst' }

describe('postConSobre: data y el sobre completo en una sola llamada', () => {
  it('devuelve data y los campos del sobre que van al lado de data', async () => {
    responder(200, SOBRE_COBRO)
    const r = await api.postConSobre<string, { tipoCuenta?: string }>('/api/v1/Finanzas/pagos/multilinea', { monto: 1 })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r.data).toBe('p1')
    expect(r.sobre?.tipoCuenta).toBe('Tst')
  })

  it('api.post sigue devolviendo solo data', async () => {
    responder(200, SOBRE_COBRO)
    expect(await api.post('/api/v1/Finanzas/pagos/multilinea', { monto: 1 })).toBe('p1')
  })

  it('sin sobre (JSON crudo o 204) devuelve lo que llegó y sobre null', async () => {
    responder(200, { id: 'x' })
    expect(await api.postConSobre('/x', {})).toEqual({ data: { id: 'x' }, sobre: null })
    responder(204, undefined)
    expect(await api.postConSobre('/x', {})).toEqual({ data: undefined, sobre: null })
  })

  it('un sobre de error sigue lanzando ApiError con su motivo', async () => {
    responder(409, { statusCode: 409, succeeded: false, message: 'Conflicto de concurrencia al actualizar el saldo.', errors: [] })
    const e = await fallo(api.postConSobre('/api/v1/Finanzas/pagos/multilinea', {}))
    expect(e).toMatchObject({ status: 409, message: 'Conflicto de concurrencia al actualizar el saldo.' })
  })

  it('tras un 401 y el token renovado, el reintento también devuelve el sobre', async () => {
    configureApiClient({ getToken: () => 't', getRefreshToken: () => 'r1', onTokensRefreshed: jest.fn(), onUnauthorized: jest.fn() })
    responder(401, {})
    responder(200, { access_token: 'nuevo', refresh_token: 'r2' })
    responder(200, SOBRE_COBRO)
    const r = await api.postConSobre<string, { tipoCuenta?: string }>('/api/v1/Pagos', {})
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(r).toMatchObject({ data: 'p1', sobre: { tipoCuenta: 'Tst' } })
  })
})
