import { formatImporte } from '@/core/ui/fw'
import { totalesDeLaLista } from '../../lib/resumenVentas'

describe('totalesDeLaLista (tarjeta de totales de la lista de ventas)', () => {
  const resumen = { totalVendido: 1286450, totalPresupuestado: 500000, porAutorizar: 2, cantidad: 12 }

  it('en Pedidos muestra lo vendido sin anuladas y cuántas esperan autorización', () => {
    expect(totalesDeLaLista(resumen, 2)).toEqual({ rotulo: 'Vendido · sin anuladas', importe: formatImporte(1286450), porAutorizar: 2 })
  })

  it('en Presupuestos muestra lo presupuestado', () => {
    expect(totalesDeLaLista(resumen, 1)).toEqual({ rotulo: 'Presupuestado · sin anuladas', importe: formatImporte(500000), porAutorizar: 2 })
  })

  it('sin resumen filtrado (servidor anterior, sin cantidad) no hay tarjeta', () => {
    expect(totalesDeLaLista(undefined, 2)).toBeNull()
    expect(totalesDeLaLista({ totalVendido: 10, totalPresupuestado: 0 }, 2)).toBeNull()
  })

  it('sin porAutorizar el conteo es cero y la tarjeta igual se muestra', () => {
    expect(totalesDeLaLista({ totalVendido: 10, totalPresupuestado: 0, cantidad: 1 }, 2)?.porAutorizar).toBe(0)
  })
})
