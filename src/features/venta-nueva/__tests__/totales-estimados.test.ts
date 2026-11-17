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

  it('el descuento general sale redondeado (0,005 → 0,01) pero el total no lo usa: 0,495 → 0,50 como el servidor', () => {
    const t = totalesEstimados([linea(0.5, 1)], 1)
    expect(t.descuento).toBe(0.01)
    expect(t.total).toBe(0.5)
  })

  it('RED-06 B) 1 × 100,10 con 5 % general: 95,10 y no 95,09', () => {
    expect(totalesEstimados([linea(100.1, 1)], 5).total).toBe(95.1)
  })

  it('RED-06 C) 12 × 10,10 al 5 % + 1 × 100,10, 5 % general, flete 1500: 1704,54', () => {
    const t = totalesEstimados([linea(10.1, 12, 5), linea(100.1, 1)], 5, 1500)
    expect(t.subtotal).toBe(215.3)
    expect(t.total).toBe(1704.54)
  })

  it('precios enteros no cambian', () => {
    expect(totalesEstimados([linea(100, 2)], 10, 5)).toEqual({ subtotal: 200, descuento: 20, flete: 5, total: 185 })
  })
})
