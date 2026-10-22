import { superaElTope } from '../lib/avisos'
import { producto } from '../__testing__/producto'

const linea = (descuentoPct: number) => ({ productoId: 'p1', producto: producto(), cantidad: 1, descuentoPct })

describe('¿la venta pasa el tope de descuento del vendedor?', () => {
  it('no pasa si ninguna línea ni el descuento general superan el tope', () => {
    expect(superaElTope([linea(10)], 3, 10, false)).toBe(false)
  })
  it('pasa si una línea supera el tope', () => {
    expect(superaElTope([linea(12)], 0, 10, false)).toBe(true)
  })
  it('pasa si el descuento general supera el tope', () => {
    expect(superaElTope([linea(0)], 11, 10, false)).toBe(true)
  })
  it('sin tope configurado y sin exención no es "pasar el tope": el servidor lo rechaza por otra regla', () => {
    expect(superaElTope([linea(5)], 0, 0, false)).toBe(false)
  })
  it('quien está exento no tiene tope', () => {
    expect(superaElTope([linea(50)], 0, 0, true)).toBe(false)
  })
})
