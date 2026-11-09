import { cantidadValida, lineaDesdeDetalle, nombreDeEmpaque, pasoDeCantidad, textoDeLinea, type LineaCompra } from '../lib/lineaCompra'

const linea = (p: Partial<LineaCompra>): LineaCompra => ({ productoId: 'p', nombre: 'P', cantidad: 1, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 10, ...p })

describe('textoDeLinea', () => {
  it('por unidad dice solo las unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 240 }))).toBe('240 u')
  })
  it('por bulto dice los bultos, lo que trae cada uno y las unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 20, unidad: 'Bulto', unidadesPorUnidad: 12 }))).toBe('20 bultos × 12 = 240 u')
  })
  it('por bulto madre dice bultos madre', () => {
    expect(textoDeLinea(linea({ cantidad: 5, unidad: 'BultoMadre', unidadesPorUnidad: 48 }))).toBe('5 bultos madre × 48 = 240 u')
  })
  it('un bulto de una unidad se dice como unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 3, unidad: 'Bulto', unidadesPorUnidad: 1 }))).toBe('3 u')
  })
})

describe('nombreDeEmpaque', () => {
  it('singular y plural de cada empaque', () => {
    expect(nombreDeEmpaque('BultoMadre')).toBe('Bulto madre')
    expect(nombreDeEmpaque('Bulto', true)).toBe('Bultos')
  })
})

describe('medida de compra igual que venta', () => {
  it('un borrador guardado en Pack se relee en unidades (ya no hay nivel Pack)', () => {
    const l = lineaDesdeDetalle({ productoId: 'p', nombreProducto: 'X', cantidad: 16, cantidadIngresada: 2, unidadCompra: 'Pack', costoUnitarioBaseAmount: 10, moneda: 'ARS' } as never)
    expect(l).toEqual(expect.objectContaining({ unidad: 'Unidad', cantidad: 16, unidadesPorUnidad: 1 }))
  })

  it('en Unidad solo se aceptan múltiplos del pack; sin pack, cualquier cantidad', () => {
    const f = { ventaMinimaUnidades: 8 }
    expect([8, 16, 24].every((c) => cantidadValida('Unidad', c, f))).toBe(true)
    expect([12, 4, 0, null].some((c) => cantidadValida('Unidad', c, f))).toBe(false)
    expect(cantidadValida('Unidad', 5, { bultoContenido: 12 })).toBe(true)
    expect(cantidadValida('Bulto', 1.5, f)).toBe(false)
    expect(pasoDeCantidad('Unidad', f)).toBe(8)
    expect(pasoDeCantidad('Bulto', f)).toBe(1)
  })
})
