import { ApiError } from '@/core/api/client'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
}))

import { leerCola } from '../lib/cola'
import { encolarSiFaltaSenal } from '../lib/encolarSinSenal'

const alta = (extra: Partial<AltaVenta> = {}): AltaVenta => ({
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-abc', ...extra,
})
const datos = (extra: Partial<AltaVenta> = {}) => ({ alta: alta(extra), cliente: { direccion: 'Alem 3669' }, visto: { total: 570, precios: { p1: 100 } } })
const sinRed = () => new TypeError('Network request failed')

beforeEach(() => mockDisco.clear())

describe('vender sin señal desde la venta (T5b)', () => {
  it('si el alta falló por falta de conexión, la venta queda en el teléfono con su clave y su totalEsperado', () => {
    const v = encolarSiFaltaSenal('u1', sinRed(), datos())
    expect(v).not.toBeNull()
    expect(leerCola('u1')).toHaveLength(1)
    expect(leerCola('u1')[0]).toMatchObject({
      clave: 'mobile-abc',
      alta: { claveIdempotencia: 'mobile-abc', totalEsperado: 570 },
      // El POST salió y no hubo respuesta: pudo grabarse, así que se reintenta el alta con la misma clave.
      estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' } },
    })
  })

  it('tocar Confirmar de nuevo con la misma clave no duplica la venta en la cola', () => {
    encolarSiFaltaSenal('u1', sinRed(), datos())
    encolarSiFaltaSenal('u1', sinRed(), datos())
    expect(leerCola('u1')).toHaveLength(1)
  })

  it('un error del servidor (no de la conexión) no se encola: lo ve el vendedor en la venta', () => {
    expect(encolarSiFaltaSenal('u1', new ApiError(400, 'Cliente inválido'), datos())).toBeNull()
    expect(encolarSiFaltaSenal('u1', new ApiError(500, 'boom'), datos())).toBeNull()
    expect(encolarSiFaltaSenal('u1', new TypeError('x is not a function'), datos())).toBeNull()
    expect(leerCola('u1')).toEqual([])
  })

  it('sin usuario no se encola (la cola es de cada usuario)', () => {
    expect(encolarSiFaltaSenal(undefined, sinRed(), datos())).toBeNull()
  })
})
