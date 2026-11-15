import { conClave, crearIntento } from '../idempotencia'

const enviadas = () => {
  const claves: string[] = []
  return { claves, enviar: (c: { claveIdempotencia: string }) => { claves.push(c.claveIdempotencia); return Promise.resolve('ok') } }
}

describe('conClave: una clave por intento del usuario', () => {
  it('manda la clave en el cuerpo sin tocar lo demás', async () => {
    const intento = crearIntento()
    const e = jest.fn().mockResolvedValue('ok')
    await conClave(intento, { monto: 10 }, e)
    expect(e).toHaveBeenCalledWith({ monto: 10, claveIdempotencia: expect.stringMatching(/^mobile-/) })
  })

  it('un reintento tras un fallo (red, 4xx, 5xx) repite la misma clave', async () => {
    const intento = crearIntento()
    const claves: string[] = []
    const falla = (c: { claveIdempotencia: string }) => { claves.push(c.claveIdempotencia); return Promise.reject(new Error('Network request failed')) }
    await expect(conClave(intento, { monto: 10 }, falla)).rejects.toThrow()
    await expect(conClave(intento, { monto: 10 }, falla)).rejects.toThrow()
    await conClave(intento, { monto: 10 }, (c) => { claves.push(c.claveIdempotencia); return Promise.resolve('ok') })
    expect(new Set(claves).size).toBe(1)
    expect(claves).toHaveLength(3)
  })

  it('un doble toque (dos envíos seguidos con el mismo cuerpo) manda la misma clave', async () => {
    const intento = crearIntento()
    const { claves, enviar } = enviadas()
    await Promise.all([conClave(intento, { monto: 10 }, enviar), conClave(intento, { monto: 10 }, enviar)])
    expect(claves[1]).toBe(claves[0])
  })

  it('al terminar bien, el intento siguiente con el mismo cuerpo es otra operación y otra clave', async () => {
    const intento = crearIntento()
    const { claves, enviar } = enviadas()
    await conClave(intento, { monto: 10 }, enviar)
    await conClave(intento, { monto: 10 }, enviar)
    expect(claves[1]).not.toBe(claves[0])
  })

  it('si el usuario cambió el cuerpo tras un error, sale otra clave (el servidor da 409 a la misma con otro cuerpo)', async () => {
    const intento = crearIntento()
    const { claves, enviar } = enviadas()
    await expect(conClave(intento, { monto: 10 }, () => Promise.reject(new Error('x')))).rejects.toThrow()
    const antes = intento.paraCuerpo({ monto: 10 })
    await conClave(intento, { monto: 20 }, enviar)
    expect(claves[0]).not.toBe(antes)
    // Y volver al cuerpo anterior reencuentra su clave: sigue siendo el mismo intento.
    expect(intento.paraCuerpo({ monto: 10 })).toBe(antes)
  })

  it('la ruta cuenta: el mismo cuerpo contra otro id es otra operación (dos compras a la par no se pisan)', async () => {
    const intento = crearIntento()
    expect(intento.paraCuerpo({}, 'a')).not.toBe(intento.paraCuerpo({}, 'b'))
    expect(intento.paraCuerpo({}, 'a')).toBe(intento.paraCuerpo({}, 'a'))
  })

  it('acota la memoria: no guarda más de 50 intentos sin terminar', () => {
    const intento = crearIntento()
    const primera = intento.paraCuerpo({ n: 0 })
    for (let n = 1; n <= 60; n++) intento.paraCuerpo({ n })
    expect(intento.paraCuerpo({ n: 0 })).not.toBe(primera)
  })
})
