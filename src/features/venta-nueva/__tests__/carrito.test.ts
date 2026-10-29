import { agregar, cantidadEn, leyendaMultiplo, subtotalLinea, sumar, totalEstimado } from '../lib/carrito'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { cajaDe6, producto } from '../__testing__/producto'

describe('carrito de la venta: múltiplo de la unidad de venta', () => {
  it('agregar un producto que se vende por caja de 6 entra con 6', () => {
    expect(cantidadEn(agregar([], cajaDe6()), 'p6')).toBe(6)
  })

  it('+ salta de a 6', () => {
    expect(cantidadEn(sumar(agregar([], cajaDe6()), 'p6'), 'p6')).toBe(12)
  })

  it('"+ Añadir" sobre un producto que ya está suma un múltiplo más', () => {
    expect(cantidadEn(agregar(agregar([], cajaDe6()), cajaDe6()), 'p6')).toBe(12)
  })

  it('por unidad va de a 1 y no tiene leyenda; la caja dice "Se vende por caja de 6"', () => {
    expect(cantidadEn(sumar(agregar([], producto()), 'p1'), 'p1')).toBe(2)
    expect(leyendaMultiplo(producto())).toBeNull()
    expect(leyendaMultiplo(cajaDe6())).toBe('Se vende por caja de 6')
  })
})

describe('total estimado', () => {
  it('suma el precio que manda el servidor por la cantidad; la oferta vigente le gana a la lista', () => {
    let l = agregar([], producto({ precioVenta: 100 }))
    l = sumar(l, 'p1')
    l = agregar(l, cajaDe6({ precioVenta: 50, precioConOferta: 40 }))
    expect(totalEstimado(l)).toBe(2 * 100 + 6 * 40)
  })

  it('el descuento de la línea baja su subtotal y el total estimado, igual que Editar línea', () => {
    const l = [{ ...agregar([], producto({ precioVenta: 100 }))[0], cantidad: 2, descuentoPct: 10 }, ...agregar([], cajaDe6({ precioVenta: 50 }))]
    expect(subtotalLinea(l[0])).toBe(180)
    expect(totalEstimado(l)).toBe(180 + 6 * 50)
  })
})

describe('useCarritoVenta', () => {
  it('lleva el estado con las mismas reglas', () => {
    const s = useCarritoVenta.getState()
    s.agregar(cajaDe6())
    s.agregar(cajaDe6())
    expect(useCarritoVenta.getState().lineas[0].cantidad).toBe(12)
    s.quitar('p6')
    expect(useCarritoVenta.getState().lineas).toEqual([])
  })
})
