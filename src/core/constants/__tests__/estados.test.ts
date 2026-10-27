import { esEstadoCompra, esEstadoHojaRuta, esEstadoVenta } from '../estados'

describe('esEstadoVenta / esEstadoHojaRuta / esEstadoCompra (L-33)', () => {
  it('la venta llega como nombre, número o número en texto', () => {
    expect(esEstadoVenta('Empacada', 'Empacada')).toBe(true)
    expect(esEstadoVenta(4, 'Empacada')).toBe(true)
    expect(esEstadoVenta('4', 'Empacada')).toBe(true)
    expect(esEstadoVenta('4', 'Confirmada', 'EnRuta')).toBe(false)
  })

  it('un estado desconocido o vacío no es ninguno', () => {
    expect(esEstadoVenta('Inventado', 'Anulada', 'Pendiente')).toBe(false)
    expect(esEstadoVenta(99, 'Anulada')).toBe(false)
    expect(esEstadoVenta(null, 'Anulada')).toBe(false)
    expect(esEstadoVenta(undefined, 'Anulada')).toBe(false)
  })

  it('hoja de ruta por número o por nombre', () => {
    expect(esEstadoHojaRuta(2, 'EnCurso')).toBe(true)
    expect(esEstadoHojaRuta('EnCurso', 'EnCurso')).toBe(true)
    expect(esEstadoHojaRuta(3, 'EnCurso', 'Cancelada')).toBe(false)
    expect(esEstadoHojaRuta(9, 'EnCurso')).toBe(false)
  })

  it('la compra llega por nombre', () => {
    expect(esEstadoCompra('NotaPedido', 'NotaPedido', 'Confirmado')).toBe(true)
    expect(esEstadoCompra('Entregado', 'NotaPedido', 'Confirmado')).toBe(false)
    expect(esEstadoCompra(undefined, 'NotaPedido')).toBe(false)
    expect(esEstadoCompra('Otro', 'NotaPedido')).toBe(false)
  })
})
