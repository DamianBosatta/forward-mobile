import { abrirCajaSchema, createCompraSchema, createVentaSchema, registrarPagoSchema } from '../validations'

const UUID = '11111111-1111-4111-8111-111111111111'
const compra = (parcial: Record<string, unknown> = {}, detalle: Record<string, unknown> = {}) => ({
  proveedorId: UUID,
  depositoId: UUID,
  gastosOperativos: 0,
  descuentoPorcentaje: 0,
  estado: 2,
  detalles: [{ productoId: UUID, cantidad: 2, costoUnitario: 50, descuentoPorcentaje: 0, monedaCosto: 'ARS', ...detalle }],
  ...parcial,
})

// C-010 / L-26: los formularios corren los límites del esquema generado desde el contrato.
describe('createCompraSchema', () => {
  it('una compra válida pasa (flujo previo)', () => {
    expect(createCompraSchema.safeParse(compra()).success).toBe(true)
  })

  it.each([
    ['costo unitario en 0 (el alta pide > 0)', compra({}, { costoUnitario: 0 })],
    ['cantidad en 0', compra({}, { cantidad: 0 })],
    ['moneda que no es ARS (A-515)', compra({}, { monedaCosto: 'USD' })],
    ['descuento mayor a 100', compra({ descuentoPorcentaje: 101 })],
    ['gastos negativos', compra({ gastosOperativos: -1 })],
    ['sin productos', compra({ detalles: [] })],
  ])('rechaza %s', (_n, payload) => {
    expect(createCompraSchema.safeParse(payload).success).toBe(false)
  })
})

describe('createVentaSchema', () => {
  const venta = (parcial: Record<string, unknown> = {}) => ({
    clienteId: UUID,
    depositoId: UUID,
    metodoEntrega: 2,
    detalles: [{ productoId: UUID, cantidad: 3, precioUnitario: 10 }],
    ...parcial,
  })

  it('una venta válida pasa (flujo previo)', () => {
    expect(createVentaSchema.safeParse(venta()).success).toBe(true)
  })

  it('rechaza descuento general mayor a 100', () => {
    expect(createVentaSchema.safeParse(venta({ descuentoGeneral: 101 })).success).toBe(false)
  })

  it('rechaza descuento de línea mayor a 100', () => {
    const d = [{ productoId: UUID, cantidad: 3, precioUnitario: 10, descuentoPorcentaje: 101 }]
    expect(createVentaSchema.safeParse(venta({ detalles: d })).success).toBe(false)
  })

  it('rechaza cantidad en 0', () => {
    const d = [{ productoId: UUID, cantidad: 0, precioUnitario: 10 }]
    expect(createVentaSchema.safeParse(venta({ detalles: d })).success).toBe(false)
  })
})

describe('pago y caja', () => {
  it('un pago con 3 decimales se rechaza (pago/monto-dos-decimales)', () => {
    const pago = { entidadId: UUID, monto: 10.123, medioPago: 'Efectivo', tipo: 'Cobranza' }
    expect(registrarPagoSchema.safeParse(pago).success).toBe(false)
    expect(registrarPagoSchema.safeParse({ ...pago, monto: 10.12 }).success).toBe(true)
  })

  it('abrir caja: saldo >= 0 y hasta 2 decimales', () => {
    expect(abrirCajaSchema.safeParse({ saldoInicial: 0 }).success).toBe(true)
    expect(abrirCajaSchema.safeParse({ saldoInicial: -1 }).success).toBe(false)
    expect(abrirCajaSchema.safeParse({ saldoInicial: 1.234 }).success).toBe(false)
  })
})
