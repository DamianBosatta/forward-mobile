import { descripcionDe, diaCorto, textoImputacion, textoVencimiento, unirMovimientos } from '../lib/movimientos'
import { mov } from '../__testing__/servidor'

it('une las dos cuentas del más nuevo al más viejo y marca la cuenta de cada movimiento', () => {
  const lista = unirMovimientos([
    { cuenta: 'Tst', items: [mov('t2', '2026-09-30T12:00:00Z'), mov('t1', '2026-08-20T12:00:00Z')], hayMas: false },
    { cuenta: 'Normal', items: [mov('n1', '2026-10-07T12:00:00Z')], hayMas: false },
  ])

  expect(lista.map(m => `${m.id}:${m.cuenta}`)).toEqual(['n1:Normal', 't2:Tst', 't1:Tst'])
})

it('no muestra nada más viejo que lo último cargado de una cuenta que todavía tiene páginas', () => {
  const lista = unirMovimientos([
    { cuenta: 'Tst', items: [mov('t2', '2026-09-30T12:00:00Z'), mov('t1', '2026-08-20T12:00:00Z')], hayMas: false },
    { cuenta: 'Normal', items: [mov('n1', '2026-10-07T12:00:00Z'), mov('n2', '2026-09-15T12:00:00Z')], hayMas: true },
  ])

  // En la cuenta Normal puede haber movimientos sin pedir entre el 15-09 y el 20-08: t1 espera.
  expect(lista.map(m => m.id)).toEqual(['n1', 't2', 'n2'])
})

describe('texto de vencimiento e imputación', () => {
  it('el vencimiento es el día del servidor, sin correrse por el huso', () => {
    expect(diaCorto('2026-10-17')).toBe('17 oct')
    expect(diaCorto('2026-01-01')).toBe('1 ene')
    expect(textoVencimiento('2026-10-17')).toBe('Vence 17 oct')
  })

  it('sin vencimiento (o con uno ilegible) no hay texto', () => {
    expect(textoVencimiento(null)).toBe('')
    expect(textoVencimiento(undefined)).toBe('')
    expect(textoVencimiento('')).toBe('')
    expect(textoVencimiento('pronto')).toBe('')
  })

  it('lista los comprobantes a los que se imputó y resume desde el cuarto', () => {
    const i = (...cs: string[]) => cs.map(comprobante => ({ comprobante, monto: 1 }))
    expect(textoImputacion(i('A00409'))).toBe('Imputado a A00409')
    expect(textoImputacion(i('A1', 'A2', 'A3'))).toBe('Imputado a A1, A2, A3')
    expect(textoImputacion(i('A1', 'A2', 'A3', 'A4'))).toBe('Imputado a A1, A2, A3 y 1 más')
    expect(textoImputacion([])).toBe('')
    expect(textoImputacion(undefined)).toBe('')
  })

  it('el concepto suma el comprobante salvo que ya lo diga', () => {
    expect(descripcionDe({ referencia: 'Entrega de Venta', comprobante: 'A00409' })).toBe('Entrega de Venta · A00409')
    expect(descripcionDe({ referencia: 'Venta A00409 entregada', comprobante: 'A00409' })).toBe('Venta A00409 entregada')
    expect(descripcionDe({ referencia: 'Cobro', comprobante: null })).toBe('Cobro')
    expect(descripcionDe({ referencia: 'Cobro' })).toBe('Cobro')
  })
})
