import { PASOS_DE_LA_VENTA, pasosDeLaVenta } from '../lineaDeTiempo'

describe('línea de tiempo del pedido (lámina ResVentaDetalle)', () => {
  it('son cinco pasos', () => {
    expect(PASOS_DE_LA_VENTA).toEqual(['Confirmado', 'Preparando', 'Empacado', 'En ruta', 'Entregado'])
  })
  it('Confirmada: el primero hecho', () => {
    expect(pasosDeLaVenta('Confirmada')).toEqual([
      { etiqueta: 'Confirmado', avance: 'completo', actual: true },
      { etiqueta: 'Preparando', avance: 'vacio', actual: false },
      { etiqueta: 'Empacado', avance: 'vacio', actual: false },
      { etiqueta: 'En ruta', avance: 'vacio', actual: false },
      { etiqueta: 'Entregado', avance: 'vacio', actual: false },
    ])
  })
  it('En preparación: el paso actual va por la mitad', () => {
    const p = pasosDeLaVenta('EnPreparacion')!
    expect(p.map((x) => x.avance)).toEqual(['completo', 'medio', 'vacio', 'vacio', 'vacio'])
    expect(p.find((x) => x.actual)?.etiqueta).toBe('Preparando')
  })
  it('Entregada: todo completo', () => {
    expect(pasosDeLaVenta(6)!.every((x) => x.avance === 'completo')).toBe(true)
    expect(pasosDeLaVenta(6)![4].actual).toBe(true)
  })
  it.each(['Pendiente', 'PendienteAutorizacion', 'Anulada', 'RechazadaAutorizacion', 'Vencido', 'NoEntregada'])(
    '%s no tiene línea de tiempo',
    (e) => expect(pasosDeLaVenta(e)).toBeNull(),
  )
})
