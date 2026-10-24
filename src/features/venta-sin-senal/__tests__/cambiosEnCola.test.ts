import { producto } from '@/features/venta-nueva/__testing__/producto'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'
import { lineasQueCambiaron, textoDeLineaCambiada } from '../lib/cambiosEnCola'
import type { VentaEnCola } from '../lib/cola'

const venta = (clave: string, items: { productoId: string; cantidad: number }[], estado: VentaEnCola['estado'] = { tipo: 'esperando', fase: { paso: 'nueva' }, intentos: 0 }): VentaEnCola => ({
  clave,
  alta: { clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false, descuentoGeneral: 0, claveIdempotencia: clave, items: items.map((i) => ({ ...i, descuentoPorcentaje: 0 })) } as AltaVenta as unknown as VentaEnCola['alta'],
  encoladaEn: 1, cliente: {} as never, visto: { total: 0, precios: {} }, estado,
})

describe('lineasQueCambiaron (S3)', () => {
  const catalogo = [
    producto({ id: 'p1', nombre: 'Producto X', disponible: 3 }),
    producto({ id: 'p2', nombre: 'Producto Y', disponible: 50 }),
  ]

  it('marca las líneas de las ventas en cola a las que ya no les alcanza el stock', () => {
    const r = lineasQueCambiaron([venta('v1', [{ productoId: 'p1', cantidad: 5 }, { productoId: 'p2', cantidad: 5 }])], catalogo)
    expect(r).toEqual([{ clave: 'v1', productoId: 'p1', nombre: 'Producto X', disponible: 3, cantidad: 5 }])
  })

  it('ignora las ventas que ya no esperan (enviadas, en Borradores o para revisar)', () => {
    const enviada = venta('v2', [{ productoId: 'p1', cantidad: 5 }], { tipo: 'enviada', ventaId: 'x', codigo: null, estado: null })
    expect(lineasQueCambiaron([enviada], catalogo)).toEqual([])
  })

  it('un producto que el catálogo no tiene no se marca (no hay con qué comparar)', () => {
    expect(lineasQueCambiaron([venta('v1', [{ productoId: 'zzz', cantidad: 5 }])], catalogo)).toEqual([])
  })

  it('el texto dice cuánto queda y cuánto lleva la venta', () => {
    expect(textoDeLineaCambiada({ clave: 'v1', productoId: 'p1', nombre: 'Producto X', disponible: 3, cantidad: 5 }))
      .toBe('Quedan 3 de Producto X (la venta guardada lleva 5)')
    expect(textoDeLineaCambiada({ clave: 'v1', productoId: 'p1', nombre: 'Producto X', disponible: 0, cantidad: 5 }))
      .toBe('Producto X se quedó sin stock (la venta guardada lleva 5)')
  })
})
