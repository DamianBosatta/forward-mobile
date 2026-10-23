import { aAlta, aAutoguardado, errorDeAltaVenta, type Cabecera } from '../lib/payload'
import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'
import type { LineaCarrito } from '../lib/carrito'

const CAB: Cabecera = { metodoEntrega: METODO_ENTREGA.Logistica, fecha: '2026-11-03', flete: 0, observaciones: '' }
const linea = (parcial: Partial<LineaCarrito> = {}) =>
  ({ productoId: 'p-1', cantidad: 2, descuentoPct: 0, ...parcial }) as LineaCarrito
const alta = (lineas: LineaCarrito[], descuentoGeneral = 0, cab: Cabecera = CAB, porcentajeComisionCedido?: number) =>
  aAlta(lineas, descuentoGeneral, cab, {
    clienteId: 'c-1', depositoId: 'd-1', esPedido: true, claveIdempotencia: 'mobile-abc', porcentajeComisionCedido,
  })

// C-010 / L-26: el alta corre el esquema generado desde el contrato (CreateVentaCommand).
describe('errorDeAltaVenta', () => {
  it('un alta válida pasa (flujo previo)', () => {
    expect(errorDeAltaVenta(alta([linea()], 10, { ...CAB, flete: 300 }))).toBeNull()
  })

  it('rechaza lo que el contrato rechaza: cantidad en 0', () => {
    expect(errorDeAltaVenta(alta([linea({ cantidad: 0 })]))).not.toBeNull()
  })

  it('rechaza un descuento general fuera de 0-100', () => {
    expect(errorDeAltaVenta(alta([linea()], 101))).not.toBeNull()
  })

  it('rechaza un descuento de línea fuera de 0-100', () => {
    expect(errorDeAltaVenta(alta([linea({ descuentoPct: -1 })]))).not.toBeNull()
  })

  it('rechaza observaciones de más de 500 caracteres', () => {
    expect(errorDeAltaVenta(alta([linea()], 0, { ...CAB, observaciones: 'x'.repeat(501) }))).not.toBeNull()
  })

  it('rechaza una cesión de comisión fuera de (0, 100)', () => {
    expect(errorDeAltaVenta(alta([linea()], 0, CAB, 100))).not.toBeNull()
  })

  it('una cesión dentro del rango pasa', () => {
    expect(errorDeAltaVenta(alta([linea()], 0, CAB, 2.5))).toBeNull()
  })
})

// Con factura (V7, igual que la web: buildVentaPayload manda conFactura solo si el tilde ya tiene valor).
describe('aAlta: conFactura', () => {
  it('con el tilde definido viaja tal cual, true o false', () => {
    expect(alta([linea()], 0, { ...CAB, conFactura: true }).conFactura).toBe(true)
    expect(alta([linea()], 0, { ...CAB, conFactura: false }).conFactura).toBe(false)
  })

  it('sin valor (el default no llegó) no viaja la clave', () => {
    expect(alta([linea()])).not.toHaveProperty('conFactura')
  })

  it('el resto del cuerpo es idéntico con y sin conFactura', () => {
    const { conFactura, ...resto } = alta([linea()], 5, { ...CAB, flete: 300, observaciones: 'x', conFactura: true })
    expect(conFactura).toBe(true)
    expect(resto).toEqual(alta([linea()], 5, { ...CAB, flete: 300, observaciones: 'x' }))
  })

  it('el autoguardado (PUT) nunca lo manda', () => {
    expect(aAutoguardado([linea()], 0, { ...CAB, conFactura: true })).not.toHaveProperty('conFactura')
  })
})
