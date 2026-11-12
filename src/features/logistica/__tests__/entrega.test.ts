import { armarEntrega, formatDistancia, mediosDelChofer, razonPendiente, type FormEntrega } from '../consola/entrega'

const base: FormEntrega = {
  receptor: 'Abel', observaciones: '', remitoUrl: null, lineas: [], devolucion: {},
}
const ctx = { exigeFotoRemito: false, disponibles: { d1: 3 } }
describe('armarEntrega', () => {
  it('S15: quién recibió es opcional: sin nombre la entrega sale igual y no manda nombreReceptor', () => {
    const r = armarEntrega({ ...base, receptor: '  ' }, ctx)
    expect(r).toEqual({ entrega: { nombreReceptor: undefined, evidenciaUrl: undefined, observaciones: undefined, cobro: undefined, firma: undefined, devolucion: undefined } })
  })

  it('S15: con nombre sigue viajando recortado', () => {
    expect(armarEntrega({ ...base, receptor: ' Abel ' }, ctx)).toMatchObject({ entrega: { nombreReceptor: 'Abel' } })
  })

  it('S17: el cobro siempre va con la imputación por defecto (el pedido de hoy)', () => {
    const r = armarEntrega({ ...base, lineas: [{ medio: { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' }, monto: '500', fotoUrl: null }] }, ctx)
    expect(r).toMatchObject({ entrega: { cobro: { imputacion: 'PedidoActual', lineas: [{ medioPagoId: 'm-ef', monto: 500 }] } } })
  })

  it('S16: la devolución viaja con sus renglones tal cual, sin pasos extra', () => {
    const r = armarEntrega({ ...base, devolucion: { d1: '2' } }, ctx)
    expect(r).toMatchObject({ entrega: { devolucion: { items: [{ ventaDetalleId: 'd1', cantidad: 2 }] } } })
  })

  it('S14: lo que no se cobra no lleva motivo en las observaciones: solo lo que escribió el chofer y la devolución', () => {
    const r = armarEntrega({ ...base, observaciones: ' dejó en portería ' }, ctx)
    expect(r).toMatchObject({ entrega: { observaciones: 'dejó en portería' } })
  })

  it('no devuelve más de lo que el servidor dice que se puede; vacío o cero no es devolución', () => {
    expect(armarEntrega({ ...base, devolucion: { d1: '4' } }, ctx)).toEqual({ error: 'Se devuelve más de lo que se puede devolver de un producto.' })
    const r = armarEntrega({ ...base, devolucion: { d1: '0' } }, ctx)
    expect('entrega' in r && r.entrega.devolucion).toBeUndefined()
  })
})

describe('formatDistancia', () => {
  it('metros por debajo del kilómetro y km con un decimal', () => {
    expect(formatDistancia(850)).toBe('850 m')
    expect(formatDistancia(12345)).toBe('12,3 km')
  })
})

describe('razonPendiente', () => {
  const ok = { entregado: true, motivo: null, subiendo: false }
  it('S15: entrega: sin quién recibió no hay razón para frenar', () => {
    expect(razonPendiente(ok)).toBeNull()
  })
  it('no entrega: pide el motivo', () => {
    expect(razonPendiente({ ...ok, entregado: false })).toBe('Falta elegir el motivo')
    expect(razonPendiente({ ...ok, entregado: false, motivo: 'Dirección incorrecta' })).toBeNull()
  })
  it('con una foto subiendo espera, aunque el resto esté completo', () => {
    expect(razonPendiente({ ...ok, subiendo: true })).toBe('Subiendo la foto: esperá un momento')
  })
})

describe('mediosDelChofer', () => {
  it('S13: deja Efectivo, Transferencia y Cheque en ese orden y saca Tarjeta aunque un servidor viejo la mande', () => {
    const lista = [
      { id: 't', nombre: 'Tarjeta', tipo: 'Tarjeta' },
      { id: 'c', nombre: 'Cheque', tipo: 'Cheque' },
      { id: 'e', nombre: 'Efectivo', tipo: 'Efectivo' },
      { id: 'x', nombre: 'Transferencia', tipo: 'Transferencia' },
      { id: 'o', nombre: 'Otro', tipo: 'Billetera' },
    ]
    expect(mediosDelChofer(lista).map((m) => m.nombre)).toEqual(['Efectivo', 'Transferencia', 'Cheque'])
    expect(mediosDelChofer(undefined)).toEqual([])
  })
})
