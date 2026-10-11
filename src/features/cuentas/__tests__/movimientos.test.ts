import { unirMovimientos } from '../lib/movimientos'
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
