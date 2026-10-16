import { armarEntrega, formatDistancia, type FormEntrega, type LineaCobroForm } from '../consola/entrega'

const CHEQUE = { id: 'm-ch', nombre: 'Cheque', tipo: 'Cheque' }
const base: FormEntrega = {
  receptor: 'Abel', observaciones: '', remitoUrl: null, lineas: [], imputacion: 'PedidoActual', firmaUrl: null, devolucion: {},
}
const ctx = { exigeFotoRemito: false, disponibles: { d1: 3 } }
const lineaCheque = (cheque: Partial<LineaCobroForm['cheque']>): LineaCobroForm => ({
  medio: CHEQUE, monto: '1.500', fotoUrl: null,
  cheque: { numero: '123', banco: 'Nación', titular: 'Abel SA', emision: '10/10/2026', pago: '30/10/2026', ...cheque },
})

describe('armarEntrega', () => {
  it('quién recibió es obligatorio aunque no se exija la foto', () => {
    expect(armarEntrega({ ...base, receptor: '  ' }, ctx)).toEqual({ error: 'Falta quién recibió.' })
  })

  it('un cheque viaja con sus datos y el monto de la línea, con las fechas como las lee el servidor', () => {
    const r = armarEntrega({ ...base, lineas: [lineaCheque({})] }, ctx)
    expect(r).toEqual({
      entrega: expect.objectContaining({
        cobro: {
          imputacion: 'PedidoActual',
          lineas: [{
            medioPagoId: 'm-ch', monto: 1500,
            cheques: [{ numero: '123', banco: 'Nación', titular: 'Abel SA', fechaEmision: '2026-10-10', fechaPago: '2026-10-30', monto: 1500 }],
          }],
        },
      }),
    })
  })

  it('un cheque sin titular o con la fecha mal escrita no sale', () => {
    expect(armarEntrega({ ...base, lineas: [lineaCheque({ titular: '' })] }, ctx)).toEqual({ error: 'Completá número, banco y titular del cheque (cobro 1).' })
    expect(armarEntrega({ ...base, lineas: [lineaCheque({ pago: '31/02/2026' })] }, ctx)).toEqual({ error: 'Las fechas del cheque van como dd/mm/aaaa (cobro 1).' })
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
