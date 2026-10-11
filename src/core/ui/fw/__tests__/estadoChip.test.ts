import { chipForEstado } from '../estadoChip'
import { formatImporte } from '../formatImporte'

// Estados del backend (Domain/Enum/EstadoVenta.cs y EstadoCompra.cs): el
// servidor manda el nombre del enum o el código numérico según el endpoint.
describe('chipForEstado — ventas', () => {
  it.each([
    ['Pendiente', 1, 'pendiente', 'Pendiente'],
    ['Confirmada', 2, 'confirmado', 'Confirmado'],
    ['EnPreparacion', 3, 'enCurso', 'En preparación'],
    ['Empacada', 4, 'enCurso', 'Empacado'],
    ['EnRuta', 5, 'enCurso', 'En ruta'],
    ['Entregada', 6, 'entregado', 'Entregado'],
    ['NoEntregada', 7, 'porAutorizar', 'No entregado'],
    ['Anulada', 8, 'anulado', 'Anulado'],
    ['PendienteAutorizacion', 9, 'porAutorizar', 'Por autorizar'],
    ['Vencido', 10, 'pendiente', 'Vencido'],
    ['RechazadaAutorizacion', 11, 'anulado', 'Rechazado'],
  ])('%s (%i) → chip %s "%s"', (nombre, codigo, chip, label) => {
    expect(chipForEstado('venta', nombre)).toEqual({ estado: chip, label })
    expect(chipForEstado('venta', codigo)).toEqual({ estado: chip, label })
    expect(chipForEstado('venta', String(codigo))).toEqual({ estado: chip, label })
  })

  it('un estado desconocido no inventa chip', () => {
    expect(chipForEstado('venta', 'Inventado')).toBeNull()
    expect(chipForEstado('venta', 99)).toBeNull()
    expect(chipForEstado('venta', null)).toBeNull()
  })
})

describe('chipForEstado — compras', () => {
  it.each([
    ['NotaPedido', 1, 'pendiente', 'Pendiente'],
    ['Confirmado', 2, 'enCurso', 'Por recibir'],
    ['Entregado', 3, 'entregado', 'Recibido'],
    ['Cancelada', 4, 'anulado', 'Cancelado'],
    ['Anulada', 5, 'anulado', 'Anulado'],
  ])('%s (%i) → chip %s "%s"', (nombre, codigo, chip, label) => {
    expect(chipForEstado('compra', nombre)).toEqual({ estado: chip, label })
    expect(chipForEstado('compra', codigo)).toEqual({ estado: chip, label })
  })

  it('el mismo código significa cosas distintas en venta y en compra', () => {
    expect(chipForEstado('compra', 2)?.label).toBe('Por recibir')
    expect(chipForEstado('venta', 2)?.label).toBe('Confirmado')
  })
})

describe('formatImporte', () => {
  it.each([
    [12345.67, '$ 12.345,67'],
    [214560, '$ 214.560,00'],
    [0, '$ 0,00'],
    [999.996,'$ 1.000,00'],
    [1234567.8, '$ 1.234.567,80'],
    [-3300.63, '-$ 3.300,63'],
  ])('%p → %s', (valor, texto) => {
    expect(formatImporte(valor)).toBe(texto)
  })

  it('sin dato muestra un guion, no $ 0', () => {
    expect(formatImporte(null)).toBe('—')
    expect(formatImporte(undefined)).toBe('—')
    expect(formatImporte(Number.NaN)).toBe('—')
  })
})
