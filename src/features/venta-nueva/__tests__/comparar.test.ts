import { mismoContenido } from '../lib/comparar'

const venta = (items: object[], extra: object = {}) => ({ descuentoGeneral: 0, metodoEntrega: 1, items, ...extra })
const a = { productoId: 'a', cantidad: 2, descuentoPorcentaje: 0 }
const b = { productoId: 'b', cantidad: 5, descuentoPorcentaje: 10 }

describe('mismoContenido', () => {
  it('las mismas líneas en otro orden son iguales', () => {
    expect(mismoContenido(venta([a, b]), venta([b, a]))).toBe(true)
  })
  it('12.5 y 12.50 son iguales, y los decimales de más se redondean a 2', () => {
    expect(mismoContenido(venta([{ ...a, cantidad: 12.5 }]), venta([{ ...a, cantidad: 12.5 }]))).toBe(true)
    expect(mismoContenido(venta([{ ...a, cantidad: 12.5 }]), venta([{ ...a, cantidad: 12.5000001 }]))).toBe(true)
  })
  it('null, undefined y omitido son lo mismo en los opcionales', () => {
    expect(mismoContenido(venta([a]), venta([a], { fechaEntrega: null }))).toBe(true)
    expect(mismoContenido(venta([a], { cargoFlete: undefined }), venta([a], { fechaEntrega: null }))).toBe(true)
  })
  it('una diferencia real de cantidad no es igual', () => {
    expect(mismoContenido(venta([a, b]), venta([a, { ...b, cantidad: 6 }]))).toBe(false)
  })
  it('una línea de más o de menos no es igual', () => {
    expect(mismoContenido(venta([a]), venta([a, b]))).toBe(false)
  })
})
