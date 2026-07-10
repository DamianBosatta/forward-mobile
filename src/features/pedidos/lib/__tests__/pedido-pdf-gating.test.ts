import {
  canDownloadEtiquetas,
  canDownloadNotaEntrega,
  ESTADO_VENTA_NUMERIC,
} from '../pedido-pdf-gating'

/**
 * Table-driven tests for estado-based PDF action gating.
 * Each row: [estado (string), etiquetas expected, notaEntrega expected]
 */
describe('canDownloadEtiquetas', () => {
  const cases: [string | number, boolean][] = [
    // Pre-gate: neither
    [ESTADO_VENTA_NUMERIC.PENDIENTE, false],              // '1'
    [ESTADO_VENTA_NUMERIC.CONFIRMADA, false],             // '2'
    [ESTADO_VENTA_NUMERIC.EN_PREPARACION, false],         // '3' — nota yes, etiquetas NO (boundary)
    // Gate opens at Empacada
    [ESTADO_VENTA_NUMERIC.EMPACADA, true],                // '4' — both yes (boundary)
    [ESTADO_VENTA_NUMERIC.EN_RUTA, true],                 // '5'
    [ESTADO_VENTA_NUMERIC.ENTREGADA, true],               // '6'
    [ESTADO_VENTA_NUMERIC.NO_ENTREGADA, true],            // '7'
    // Terminal / cancelled
    [ESTADO_VENTA_NUMERIC.ANULADA, false],                // '8'
    [ESTADO_VENTA_NUMERIC.PENDIENTE_AUTORIZACION, false], // '9'
    // Accepts numeric input
    [3, false],
    [4, true],
    [5, true],
    // Unknown estado
    ['0', false],
    ['99', false],
  ]

  test.each(cases)('estado=%s → %s', (estado, expected) => {
    expect(canDownloadEtiquetas(estado)).toBe(expected)
  })
})

describe('canDownloadNotaEntrega', () => {
  const cases: [string | number, boolean][] = [
    // Pre-gate: neither
    [ESTADO_VENTA_NUMERIC.PENDIENTE, false],              // '1'
    [ESTADO_VENTA_NUMERIC.CONFIRMADA, false],             // '2'
    // Gate opens at EnPreparacion (boundary: nota yes, etiquetas no)
    [ESTADO_VENTA_NUMERIC.EN_PREPARACION, true],          // '3' — boundary
    [ESTADO_VENTA_NUMERIC.EMPACADA, true],                // '4' — both yes (boundary for etiquetas)
    [ESTADO_VENTA_NUMERIC.EN_RUTA, true],                 // '5'
    [ESTADO_VENTA_NUMERIC.ENTREGADA, true],               // '6'
    [ESTADO_VENTA_NUMERIC.NO_ENTREGADA, true],            // '7'
    // Terminal / cancelled
    [ESTADO_VENTA_NUMERIC.ANULADA, false],                // '8'
    [ESTADO_VENTA_NUMERIC.PENDIENTE_AUTORIZACION, false], // '9'
    // Accepts numeric input
    [2, false],
    [3, true],
    [6, true],
    // Unknown estado
    ['0', false],
    ['100', false],
  ]

  test.each(cases)('estado=%s → %s', (estado, expected) => {
    expect(canDownloadNotaEntrega(estado)).toBe(expected)
  })
})

describe('boundary cases — EnPreparacion is the nota/etiquetas split', () => {
  it('EnPreparacion (3): nota=true, etiquetas=false', () => {
    expect(canDownloadNotaEntrega('3')).toBe(true)
    expect(canDownloadEtiquetas('3')).toBe(false)
  })

  it('Empacada (4): both true', () => {
    expect(canDownloadNotaEntrega('4')).toBe(true)
    expect(canDownloadEtiquetas('4')).toBe(true)
  })

  it('Anulada (8): both false', () => {
    expect(canDownloadNotaEntrega('8')).toBe(false)
    expect(canDownloadEtiquetas('8')).toBe(false)
  })
})
