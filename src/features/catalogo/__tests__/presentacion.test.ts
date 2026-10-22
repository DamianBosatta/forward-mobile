import { detalleDeTarjeta, filtrarPorStock } from '../lib/presentacion'

describe('detalleDeTarjeta', () => {
  it('una línea con la cantidad dice "N fragancias" y, si se vende por caja, "caja de N"', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 12, ventaMinimaUnidades: 12 })).toBe('12 fragancias · caja de 12')
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 8, ventaMinimaUnidades: 1 })).toBe('8 fragancias')
  })

  it('una sola fragancia va en singular', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 1 })).toBe('1 fragancia')
  })

  it('una línea de un servidor anterior (sin cantidad) sigue diciendo "Con fragancias"', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true })).toBe('Con fragancias')
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: null, ventaMinimaUnidades: null })).toBe('Con fragancias')
  })

  it('un producto común solo dice "caja de N" cuando la venta mínima es más de una unidad', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: false, ventaMinimaUnidades: 6 })).toBe('caja de 6')
    expect(detalleDeTarjeta({ esPadreDeVariantes: false, ventaMinimaUnidades: 1 })).toBeNull()
    expect(detalleDeTarjeta({ esPadreDeVariantes: false })).toBeNull()
  })
})

describe('filtrarPorStock', () => {
  const productos = [{ id: 'a' }, { id: 'b' }, { id: 'linea' }, { id: 'sin-dato' }]
  const disponible = new Map([['a', true], ['b', false]])

  it('con el filtro prendido deja solo lo que el servidor dijo que se puede vender', () => {
    expect(filtrarPorStock(productos, disponible, true)).toEqual([{ id: 'a' }])
  })

  it('con el filtro apagado devuelve todo, en el mismo orden', () => {
    expect(filtrarPorStock(productos, disponible, false)).toEqual(productos)
  })
})
