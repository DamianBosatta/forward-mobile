import { leerDescuentoAdicional } from '../lib/descuentoAdicional'

describe('descuento adicional al autorizar: formato y rango', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['0', null],
    ['0,00', null],
    ['100', 100],
    ['100,00', 100],
    ['5.', 5],
    [',5', 0.5],
    ['.5', 0.5],
    ['2,25', 2.25],
  ])('"%s" vale %p, sin error', (texto, valor) => {
    expect(leerDescuentoAdicional(texto)).toEqual({ valor })
  })

  it.each([
    ['100,01', 'entre 0 y 100'],
    ['1,234', 'hasta 2 decimales'],
    [',', 'Escribí un número'],
    ['.', 'Escribí un número'],
    ['-5', 'Escribí un número'],
    ['5,5,5', 'Escribí un número'],
  ])('"%s" no vale: %s', (texto, aviso) => {
    const r = leerDescuentoAdicional(texto)
    expect(r.valor).toBeNull()
    expect(r.error).toMatch(aviso)
  })
})
