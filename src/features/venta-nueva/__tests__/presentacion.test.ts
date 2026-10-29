import { cajaDe6, producto } from '../__testing__/producto'
import { chipsDeDescuento, convertirModo, presentacionDe, rotuloPresentacion, unidadesDe, valorEn } from '../lib/presentacion'

describe('rotuloPresentacion: la pastilla de la tarjeta sale de la misma regla que la pantalla de oferta', () => {
  it('una caja cerrada o un bulto que se puede abrir dicen "Bulto x N u"', () => {
    expect(rotuloPresentacion(presentacionDe(cajaDe6()))).toBe('Bulto x 6 u')
    expect(rotuloPresentacion(presentacionDe(producto({ bultoContenido: 10 })))).toBe('Bulto x 10 u')
  })

  it('un pack que no es bulto cerrado se vende de a su múltiplo; sin nada de eso es Unidad', () => {
    expect(rotuloPresentacion(presentacionDe(producto({ bultoContenido: 10, ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Pack' })))).toBe('Bulto x 6 u')
    expect(rotuloPresentacion(presentacionDe(producto()))).toBe('Unidad')
  })
})

describe('presentacionDe: cómo se puede pedir un producto (decisión L4, "Respetar la regla")', () => {
  it('un producto que se vende solo por caja ofrece solo Bultos', () => {
    const pr = presentacionDe(cajaDe6())
    expect(pr.modos).toEqual(['bultos'])
    expect(pr.unidadesPorBulto).toBe(6)
    expect(pr.soloBultos).toBe(true)
  })

  it('un producto con bulto que se puede abrir ofrece Bultos y Unidades', () => {
    const pr = presentacionDe(producto({ bultoContenido: 10 }))
    expect(pr.modos).toEqual(['bultos', 'unidades'])
    expect(pr.unidadesPorBulto).toBe(10)
    expect(pr.soloBultos).toBe(false)
  })

  it('un producto sin bulto ofrece solo Unidades', () => {
    expect(presentacionDe(producto()).modos).toEqual(['unidades'])
  })

  it('un bulto que no es múltiplo de la venta mínima no se ofrece (no se podría pedir)', () => {
    const pr = presentacionDe(producto({ bultoContenido: 10, ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Pack' }))
    expect(pr.modos).toEqual(['unidades'])
  })

  it('el paso en Unidades es la venta mínima y en Bultos es uno', () => {
    const pack = presentacionDe(producto({ bultoContenido: 12, ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Pack' }))
    expect(pack.paso.unidades).toBe(6)
    expect(pack.paso.bultos).toBe(1)
  })
})

describe('conversión Bultos ↔ Unidades', () => {
  const pr = presentacionDe(producto({ bultoContenido: 10 }))

  it('Bultos × N = unidades y a la inversa', () => {
    expect(unidadesDe(pr, 'bultos', 3)).toBe(30)
    expect(unidadesDe(pr, 'unidades', 7)).toBe(7)
    expect(valorEn(pr, 'bultos', 30)).toBe(3)
  })

  it('pasar a Bultos redondea las unidades hacia arriba al próximo bulto cerrado', () => {
    expect(convertirModo(pr, 'bultos', 25)).toBe(30)
    expect(convertirModo(pr, 'bultos', 1)).toBe(10)
    expect(convertirModo(pr, 'unidades', 25)).toBe(25)
  })
})

describe('chipsDeDescuento: 0 / 5 / 10 / 15 hasta el tope del vendedor', () => {
  it('no ofrece más que su tope', () => {
    expect(chipsDeDescuento(15, false)).toEqual([0, 5, 10, 15])
    expect(chipsDeDescuento(10, false)).toEqual([0, 5, 10])
    expect(chipsDeDescuento(0, false)).toEqual([0])
  })

  it('quien está exento del tope ve todos', () => {
    expect(chipsDeDescuento(0, true)).toEqual([0, 5, 10, 15])
  })

  it('suma el tope del vendedor si no cae en la grilla', () => {
    expect(chipsDeDescuento(12, false)).toEqual([0, 5, 10, 12])
    expect(chipsDeDescuento(3, false)).toEqual([0, 3])
    expect(chipsDeDescuento(20, false)).toEqual([0, 5, 10, 15, 20])
  })
})
