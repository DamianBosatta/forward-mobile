import { totalesEstimados } from '../lib/avisos'
import { totalEstimado } from '../lib/carrito'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

const linea = (precio: number, cantidad: number, descuentoPct = 0): LineaCarrito =>
  ({ productoId: 'p1', producto: producto({ precioVenta: precio }), cantidad, descuentoPct })

describe('totales estimados: el unitario y la cabecera salen redondeados (Bloque 13, R15)', () => {
  it('el subtotal es la suma de renglones redondeados', () => {
    expect(totalEstimado([linea(6.667, 3)])).toBe(20.01)
  })

  it('el descuento general sale redondeado: 0,005 → 0,01', () => {
    const t = totalesEstimados([linea(0.5, 1)], 1)
    expect(t.descuento).toBe(0.01)
    expect(t.total).toBe(0.49)
  })

  it('precios enteros no cambian', () => {
    expect(totalesEstimados([linea(100, 2)], 10, 5)).toEqual({ subtotal: 200, descuento: 20, flete: 5, total: 185 })
  })
})
