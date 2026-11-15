import { api, ApiError } from '@/core/api/client'
import { confirmarYRecibir } from '../lib/confirmar-y-recibir'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { postConSobre: jest.fn() },
}))

const post = api.postConSobre as jest.Mock
const URL_C1 = '/api/v1/Compras/c1/confirmar-y-recibir'
const claveDe = (n: number) => post.mock.calls.filter((c) => c[0] === URL_C1)[n][1].claveIdempotencia as string

beforeEach(() => {
  jest.clearAllMocks()
  post.mockResolvedValue({ data: 'x', sobre: { message: 'ok' } })
})

describe('confirmarYRecibir: una clave por intento', () => {
  it('manda la clave y deja el cuerpo como estaba', async () => {
    const r = await confirmarYRecibir('c1', { version: 3, fechaFacturaProveedor: '2026-11-14' })
    expect(r).toMatchObject({ tipo: 'hecho', aviso: { clave: 'recibida' } })
    expect(post).toHaveBeenCalledWith(URL_C1, { version: 3, fechaFacturaProveedor: '2026-11-14', claveIdempotencia: expect.stringMatching(/^mobile-/) })
  })

  it('el reintento tras un corte (sin respuesta) o un doble toque repite la clave', async () => {
    post.mockRejectedValueOnce(new Error('Network request failed'))
    expect(await confirmarYRecibir('c1', { version: 3 })).toMatchObject({ tipo: 'hecho', aviso: { clave: 'incierto' } })
    await Promise.all([confirmarYRecibir('c1', { version: 3 }), confirmarYRecibir('c1', { version: 3 })])
    expect(claveDe(1)).toBe(claveDe(0))
    expect(claveDe(2)).toBe(claveDe(0))
  })

  it('después de recibir, otra confirmación con el mismo cuerpo usa otra clave', async () => {
    await confirmarYRecibir('c1', { version: 3 })
    await confirmarYRecibir('c1', { version: 3 })
    expect(claveDe(1)).not.toBe(claveDe(0))
  })

  it('una compra distinta con el mismo cuerpo es otra operación', async () => {
    post.mockRejectedValue(new ApiError(400, 'x'))
    await confirmarYRecibir('c1', { version: 3 })
    await confirmarYRecibir('c2', { version: 3 })
    const claves = post.mock.calls.map((c) => c[1].claveIdempotencia)
    expect(claves[1]).not.toBe(claves[0])
  })

  it('sigue traduciendo la compra ya recibida (409 CompraYaRecibida) como hecha', async () => {
    post.mockRejectedValueOnce(Object.assign(new ApiError(409, 'ya'), { codigo: 'CompraYaRecibida' }))
    expect(await confirmarYRecibir('c1', {})).toMatchObject({ tipo: 'hecho', aviso: { clave: 'ya-recibida' } })
  })
})
