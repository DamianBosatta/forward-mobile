import { avisosVenta } from '../lib/avisos'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

const ctx = { tipo: 'Pedido' as const, tope: 10, exento: false, descuentoGeneral: 0 }
const linea = (over: Parameters<typeof producto>[0], cantidad = 5): LineaCarrito => ({ productoId: 'p1', producto: producto(over), cantidad, descuentoPct: 0 })

describe('avisosVenta: falta stock según quién ve cantidades (S6, L6)', () => {
  it('quien no ve cantidades (disponible llega en 0) y puedeVenderse true: no falta stock', () => {
    expect(avisosVenta([linea({ disponible: 0, puedeVenderse: true })], { ...ctx, verCantidades: false }).porAutorizar).not.toContain('falta stock')
  })
  it('quien no ve cantidades y puedeVenderse false: falta stock', () => {
    expect(avisosVenta([linea({ disponible: 0, puedeVenderse: false })], { ...ctx, verCantidades: false }).porAutorizar).toContain('falta stock')
  })
  it('quien ve cantidades sigue comparando contra disponible, aunque puedeVenderse diga lo contrario', () => {
    expect(avisosVenta([linea({ disponible: 3, puedeVenderse: true })], { ...ctx, verCantidades: true }).porAutorizar).toContain('falta stock')
    expect(avisosVenta([linea({ disponible: 9, puedeVenderse: false })], { ...ctx, verCantidades: true }).porAutorizar).not.toContain('falta stock')
  })
  it('sin indicar verCantidades se compara contra disponible (comportamiento previo)', () => {
    expect(avisosVenta([linea({ disponible: 3 })], ctx).porAutorizar).toContain('falta stock')
  })
})

describe('avisosVenta: editar no avisa de más por lo que la venta ya tenía (S9)', () => {
  it('la cantidad que la venta ya tenía está descontada del disponible: se suma antes de comparar', () => {
    // Disponible 3 (ya sin las 5 de esta venta); pide 7 = 3 + 5 - 1: alcanza.
    expect(avisosVenta([linea({ disponible: 3 }, 7)], { ...ctx, verCantidades: true, yaReservadas: { p1: 5 } }).porAutorizar).not.toContain('falta stock')
  })
  it('si pide más que disponible + lo que ya tenía, sigue faltando stock', () => {
    expect(avisosVenta([linea({ disponible: 3 }, 9)], { ...ctx, verCantidades: true, yaReservadas: { p1: 5 } }).porAutorizar).toContain('falta stock')
  })
  it('lo que ya tenía es de ese producto: otro producto compara contra su disponible', () => {
    expect(avisosVenta([linea({ disponible: 3 }, 7)], { ...ctx, verCantidades: true, yaReservadas: { otro: 5 } }).porAutorizar).toContain('falta stock')
  })
  it('quien no ve cantidades sigue decidiendo por puedeVenderse', () => {
    expect(avisosVenta([linea({ disponible: 0, puedeVenderse: false }, 7)], { ...ctx, verCantidades: false, yaReservadas: { p1: 5 } }).porAutorizar).toContain('falta stock')
    expect(avisosVenta([linea({ disponible: 0, puedeVenderse: true }, 7)], { ...ctx, verCantidades: false, yaReservadas: { p1: 5 } }).porAutorizar).not.toContain('falta stock')
  })
})
