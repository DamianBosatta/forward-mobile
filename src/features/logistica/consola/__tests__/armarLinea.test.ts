import { armarEntrega, armarLinea, type FormEntrega, type LineaCobroForm } from '../entrega'

const efectivo = { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' } as LineaCobroForm['medio']
const linea = (monto: string): LineaCobroForm => ({ medio: efectivo, monto, fotoUrl: null })

describe('armarLinea: el monto entra en numeric(18,2) como en la API (QA F103)', () => {
  it('con más de 2 decimales no arma la línea y lo dice con el número del cobro', () => {
    expect(armarLinea(linea('100,555'), 2)).toEqual({ error: 'El monto del cobro 2 admite hasta 2 decimales.' })
  })

  it('con 2 decimales o menos sigue armando la línea', () => {
    expect(armarLinea(linea('100,55'), 1)).toEqual({ linea: { medioPagoId: 'm-ef', monto: 100.55, fotoUrl: undefined } })
    expect(armarLinea(linea('100'), 1)).toMatchObject({ linea: { monto: 100 } })
  })

  it('con más de 16 dígitos enteros no arma la línea', () => {
    expect(armarLinea(linea('10000000000000000'), 1)).toEqual({ error: 'El monto del cobro 1 admite hasta 16 dígitos enteros.' })
  })

  it('el cero y el vacío siguen con su mensaje de siempre', () => {
    expect(armarLinea(linea('0'), 1)).toEqual({ error: 'El monto del cobro 1 tiene que ser mayor a cero.' })
  })

  it('la entrega entera se frena antes de encolarse', () => {
    const form: FormEntrega = { receptor: '', observaciones: '', remitoUrl: null, lineas: [linea('100,555')], devolucion: {} }
    expect(armarEntrega(form, { exigeFotoRemito: false, disponibles: {} })).toEqual({ error: 'El monto del cobro 1 admite hasta 2 decimales.' })
  })
})
