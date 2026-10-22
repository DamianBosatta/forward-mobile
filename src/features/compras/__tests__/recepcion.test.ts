import {
  accionesDeDetalle, calcularVencimiento, CONSECUENCIA, mensajeProblemaFecha, pasosDeCompra, problemaFechaFactura,
  rangoFechaFactura, textoSuma, unidadesAIngresar,
} from '../lib/recepcion'

const todo = { eliminada: false, cantidadLineas: 3, puedeModificar: true, puedeBorrar: true, tieneCapAnular: true }
const botones = (estado: string, o: Partial<typeof todo> = {}) => accionesDeDetalle({ estado, ...todo, ...o })

describe('pasosDeCompra (R8: nota de pedido, confirmada, recibida)', () => {
  it.each([
    ['NotaPedido', ['actual', 'pendiente', 'pendiente']],
    ['Confirmado', ['hecho', 'actual', 'pendiente']],
    ['Entregado', ['hecho', 'hecho', 'actual']],
  ])('%s', (estado, esperado) => {
    const pasos = pasosDeCompra(estado)!
    expect(pasos.map((p) => p.label)).toEqual(['Nota de pedido', 'Confirmada', 'Recibida'])
    expect(pasos.map((p) => p.estado)).toEqual(esperado)
  })
  it.each(['Cancelada', 'Anulada'])('%s no tiene camino que mostrar', (estado) => expect(pasosDeCompra(estado)).toBeNull())
})

describe('accionesDeDetalle (espejo de acciones-compra.ts y AccionesBajaCompra de la web)', () => {
  it('nota de pedido: editar, confirmar y cancelar; no recibe ni anula', () => {
    expect(botones('NotaPedido')).toEqual({ editar: true, confirmar: true, recibir: false, cancelar: true, anularRecepcion: false })
  })
  it('confirmada: editar, recibir y cancelar; no confirma', () => {
    expect(botones('Confirmado')).toEqual({ editar: true, confirmar: false, recibir: true, cancelar: true, anularRecepcion: false })
  })
  it('recibida: solo anular la recepción', () => {
    expect(botones('Entregado')).toEqual({ editar: false, confirmar: false, recibir: false, cancelar: false, anularRecepcion: true })
  })
  it.each(['Cancelada', 'Anulada'])('%s: nada', (estado) => {
    expect(Object.values(botones(estado)).some(Boolean)).toBe(false)
  })
  it('una nota de pedido sin líneas no se confirma (Compra.Confirmar() las rechaza)', () => {
    expect(botones('NotaPedido', { cantidadLineas: 0 }).confirmar).toBe(false)
  })
  it('una compra eliminada es historial: no se opera', () => {
    expect(Object.values(botones('Confirmado', { eliminada: true })).some(Boolean)).toBe(false)
    expect(botones('Entregado', { eliminada: true }).anularRecepcion).toBe(false)
  })
  it('sin MOD_COMPRAS modificar no hay editar, confirmar ni recibir; cancelar sigue por borrar', () => {
    expect(botones('Confirmado', { puedeModificar: false })).toEqual({ editar: false, confirmar: false, recibir: false, cancelar: true, anularRecepcion: false })
  })
  it('sin MOD_COMPRAS borrar no hay cancelar ni anular', () => {
    expect(botones('Entregado', { puedeBorrar: false }).anularRecepcion).toBe(false)
    expect(botones('Confirmado', { puedeBorrar: false }).cancelar).toBe(false)
  })
  it('anular la recepción además pide CAP_ANULAR_RECEPCION_COMPRAS', () => {
    expect(botones('Entregado', { tieneCapAnular: false }).anularRecepcion).toBe(false)
  })
})

describe('recepción: qué suma', () => {
  it('unidadesAIngresar suma la cantidad en unidades de todas las líneas', () => {
    expect(unidadesAIngresar([{ cantidad: 24 }, { cantidad: 40 }, { cantidad: 48 }])).toBe(112)
    expect(unidadesAIngresar([])).toBe(0)
  })
  it('textoSuma', () => {
    expect(textoSuma(102)).toBe('Suma 102 unidades al stock y genera la deuda con el proveedor')
    expect(textoSuma(1)).toBe('Suma 1 unidad al stock y genera la deuda con el proveedor')
  })
})

describe('fecha de factura al recibir (web: core/domain/fecha-factura.ts)', () => {
  const dias30 = { tipo: 'DiasDesdeFactura', dias: 30 }
  it('rango: desde hace un año hasta mañana', () => {
    expect(rangoFechaFactura('2026-10-22')).toEqual({ min: '2025-10-22', max: '2026-10-23' })
    expect(rangoFechaFactura('2028-02-29')).toEqual({ min: '2027-02-28', max: '2028-03-01' })
  })
  it('sin fecha: falta solo si la condición cuenta desde la factura', () => {
    expect(problemaFechaFactura(dias30, '', '2026-10-22')).toBe('falta')
    expect(problemaFechaFactura({ tipo: 'Contado' }, '', '2026-10-22')).toBeNull()
  })
  it('fuera de rango: pasado de un año o posterior a mañana', () => {
    expect(problemaFechaFactura(dias30, '2025-10-21', '2026-10-22')).toBe('fuera-de-rango')
    expect(problemaFechaFactura(dias30, '2026-10-24', '2026-10-22')).toBe('fuera-de-rango')
    expect(problemaFechaFactura(dias30, '2025-10-22', '2026-10-22')).toBeNull()
    expect(problemaFechaFactura(dias30, '2026-10-23', '2026-10-22')).toBeNull()
  })
  it('mensajes de la web', () => {
    expect(mensajeProblemaFecha('falta')).toBe('La condición de pago cuenta los días desde la factura: cargá la fecha de factura del proveedor.')
    expect(mensajeProblemaFecha('fuera-de-rango')).toBe('La fecha de factura no puede ser posterior a mañana ni tener más de un año.')
  })
})

describe('calcularVencimiento (web: vencimiento-estimado.ts)', () => {
  it('contado: el día de la entrega', () => expect(calcularVencimiento({ tipo: 'Contado' }, '2026-10-22', null)).toBe('2026-10-22'))
  it('días desde la entrega', () => expect(calcularVencimiento({ tipo: 'DiasDesdeEntrega', dias: 30 }, '2026-10-22', null)).toBe('2026-11-21'))
  it('días desde la factura: sin fecha de factura no hay vencimiento', () => {
    expect(calcularVencimiento({ tipo: 'DiasDesdeFactura', dias: 30 }, '2026-10-22', null)).toBeNull()
    expect(calcularVencimiento({ tipo: 'DiasDesdeFactura', dias: 30 }, '2026-10-22', '2026-10-05')).toBe('2026-11-04')
  })
  it('día fijo del mes: el próximo, ajustado al último día del mes corto', () => {
    expect(calcularVencimiento({ tipo: 'DiaFijoDelMes', diaDelMes: 10 }, '2026-10-22', null)).toBe('2026-11-10')
    expect(calcularVencimiento({ tipo: 'DiaFijoDelMes', diaDelMes: 31 }, '2026-01-31', null)).toBe('2026-02-28')
  })
  it('sin condición o con dias inválidos: null', () => {
    expect(calcularVencimiento(null, '2026-10-22', null)).toBeNull()
    expect(calcularVencimiento({ tipo: 'DiasDesdeEntrega', dias: 0 }, '2026-10-22', null)).toBeNull()
  })
})

describe('consecuencias (texto de la web antes de ejecutar)', () => {
  it('recibir y anular', () => {
    expect(CONSECUENCIA.recibir).toBe('La mercadería entró al depósito. El stock virtual pasa a real y se genera la deuda con el proveedor.')
    expect(CONSECUENCIA.anularRecepcion).toMatch(/^Se descuenta del stock lo que ingresó esta compra, se revierte la deuda/)
    expect(CONSECUENCIA.anularRecepcion).toMatch(/si la compra tiene pagos imputados, no se puede anular\.$/)
  })
  it('cancelar según el estado', () => {
    expect(CONSECUENCIA.cancelarNotaPedido).toBe('La orden queda cancelada. No tocó stock ni cuenta corriente.')
    expect(CONSECUENCIA.cancelarConfirmada).toMatch(/^Se libera el stock virtual/)
  })
})
