import { aplicarCambiosAlCatalogo, avisoDeStock } from '../lib/avisoStockVivo'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

const linea = (cantidad: number, nombre = 'Producto X'): LineaCarrito => ({
  productoId: 'p1', producto: producto({ id: 'p1', nombre }), cantidad, descuentoPct: 0,
})

describe('avisoDeStock (S2)', () => {
  it('con cantidades y menos de lo cargado: "Quedan 3 de Producto X (cargaste 5)"', () => {
    expect(avisoDeStock({ productoId: 'p1', estado: 'EnAlerta', disponible: 3, stockMinimo: 10 }, linea(5)))
      .toBe('Quedan 3 de Producto X (cargaste 5)')
  })

  it('con cantidades y alcanza lo cargado pero está en alerta: igual avisa cuánto queda', () => {
    expect(avisoDeStock({ productoId: 'p1', estado: 'EnAlerta', disponible: 8, stockMinimo: 10 }, linea(5)))
      .toBe('Quedan 8 de Producto X (cargaste 5)')
  })

  it('sin stock: la venta va a ir a autorización, con o sin cantidades', () => {
    const texto = 'Producto X se quedó sin stock: la venta va a ir a autorización'
    expect(avisoDeStock({ productoId: 'p1', estado: 'SinStock', disponible: 0, stockMinimo: 0 }, linea(5))).toBe(texto)
    expect(avisoDeStock({ productoId: 'p1', estado: 'SinStock' }, linea(5))).toBe(texto)
  })

  it('sin cantidades (solo estado) nunca muestra un número: "Queda poco de Producto X"', () => {
    const t = avisoDeStock({ productoId: 'p1', estado: 'EnAlerta' }, linea(5))
    expect(t).toBe('Queda poco de Producto X')
    expect(t).not.toMatch(/\d/)
  })

  it('con stock de sobra no avisa', () => {
    expect(avisoDeStock({ productoId: 'p1', estado: 'ConStock', disponible: 50, stockMinimo: 10 }, linea(5))).toBeNull()
    expect(avisoDeStock({ productoId: 'p1', estado: 'ConStock' }, linea(5))).toBeNull()
  })

  it('con cantidades y menos de lo cargado avisa aunque el servidor diga ConStock (sin mínimo cargado)', () => {
    expect(avisoDeStock({ productoId: 'p1', estado: 'ConStock', disponible: 2, stockMinimo: 0 }, linea(5)))
      .toBe('Quedan 2 de Producto X (cargaste 5)')
  })
})

describe('aplicarCambiosAlCatalogo', () => {
  it('actualiza el disponible de las filas con cantidades y deja el resto igual', () => {
    const items = [producto({ id: 'p1', disponible: 9 }), producto({ id: 'p2', disponible: 4 })]
    const r = aplicarCambiosAlCatalogo({ items, truncado: false }, [{ productoId: 'p1', estado: 'EnAlerta', disponible: 3, stockMinimo: 5 }])
    expect(r.items[0].disponible).toBe(3)
    expect(r.items[1]).toBe(items[1])
  })

  it('acepta el catálogo guardado como arreglo (versión anterior)', () => {
    const r = aplicarCambiosAlCatalogo([producto({ id: 'p1', disponible: 9 })], [{ productoId: 'p1', estado: 'SinStock', disponible: 0, stockMinimo: 5 }])
    expect(r.items[0].disponible).toBe(0)
  })
})
