import { elegirUltimoPedido } from '../lib/ultimoPedido'

const v = (id: string, fecha: string, estado: string, tipoOperacion = 2) =>
  ({ id, fecha, estado, tipoOperacion, itemsCount: 3, totalAmount: 100 }) as never

describe('último pedido del cliente (Repetir el último pedido)', () => {
  it('sin ventas no hay qué repetir', () => {
    expect(elegirUltimoPedido(undefined)).toBeNull()
    expect(elegirUltimoPedido([])).toBeNull()
  })

  it('es el pedido más reciente, sin importar el orden en que llegue la lista', () => {
    const r = elegirUltimoPedido([v('a', '2026-10-01T10:00:00Z', 'Entregada'), v('b', '2026-10-11T10:00:00Z', 'Confirmada'), v('c', '2026-10-05T10:00:00Z', 'Entregada')])
    expect(r?.id).toBe('b')
  })

  it('un presupuesto no es un pedido', () => {
    const r = elegirUltimoPedido([v('p', '2026-10-12T10:00:00Z', 'Pendiente', 1), v('a', '2026-10-01T10:00:00Z', 'Entregada')])
    expect(r?.id).toBe('a')
  })

  it('no repite un pedido anulado, vencido ni rechazado', () => {
    const r = elegirUltimoPedido([
      v('x', '2026-10-12T10:00:00Z', 'Anulada'), v('y', '2026-10-11T10:00:00Z', 'Vencido'),
      v('z', '2026-10-10T10:00:00Z', 'RechazadaAutorizacion'), v('ok', '2026-10-01T10:00:00Z', 'PendienteAutorizacion'),
    ])
    expect(r?.id).toBe('ok')
  })

  it('un estado que la tabla no conoce (un borrador) no cuenta', () => {
    expect(elegirUltimoPedido([v('b', '2026-10-12T10:00:00Z', 'Borrador')])).toBeNull()
  })
})
