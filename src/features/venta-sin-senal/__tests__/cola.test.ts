import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

// Un "disco" que sobrevive a recargar los módulos: así se prueba un reinicio de la app de verdad
// (el módulo de la cola se vuelve a cargar y lee lo que quedó guardado, no lo que tenía en memoria).
const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
}))

type Cola = typeof import('../lib/cola')
const cargarCola = (): Cola => {
  let m: Cola | undefined
  jest.isolateModules(() => { m = require('../lib/cola') })
  return m!
}

const alta = (extra: Partial<AltaVenta> = {}): AltaVenta => ({
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: '', ...extra,
})
const datos = (extra: Partial<AltaVenta> = {}) => ({
  alta: alta(extra),
  cliente: { direccion: 'Alem 3669', nombreFantasia: 'Almacén Rosa' },
  visto: { total: 61204.1, precios: { p1: 10200.68 } },
})

beforeEach(() => mockDisco.clear())

describe('cola de ventas sin señal (V9, D4)', () => {
  it('sobrevive a reiniciar la app: lo encolado se lee de nuevo del teléfono', () => {
    const antes = cargarCola()
    const v = antes.encolarVenta('u1', datos(), 1_000)

    const despues = cargarCola()
    expect(despues.leerCola('u1')).toEqual([v])
    expect(v).toMatchObject({
      encoladaEn: 1_000,
      cliente: { direccion: 'Alem 3669', nombreFantasia: 'Almacén Rosa' },
      visto: { total: 61204.1, precios: { p1: 10200.68 } },
      estado: { tipo: 'esperando', fase: { paso: 'nueva' } },
    })
  })

  it('genera la clave de idempotencia una sola vez, al encolar, y la guarda en el cuerpo del POST', () => {
    const { encolarVenta, leerCola } = cargarCola()
    const v = encolarVenta('u1', datos())
    expect(v.clave).toMatch(/^mobile-/)
    expect(v.alta.claveIdempotencia).toBe(v.clave)
    expect(leerCola('u1')[0].alta.claveIdempotencia).toBe(v.clave)
    expect(leerCola('u1')[0].clave).toBe(v.clave)
  })

  it('conserva la clave de un intento que quedó sin respuesta, y ese no vuelve a la vista previa', () => {
    const { encolarVenta } = cargarCola()
    const v = encolarVenta('u1', { ...datos({ claveIdempotencia: 'mobile-abc' }), yaSeIntento: true })
    expect(v.clave).toBe('mobile-abc')
    expect(v.estado).toEqual({ tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 0 })
  })

  it('la misma clave encolada dos veces queda una sola vez', () => {
    const { encolarVenta, leerCola } = cargarCola()
    encolarVenta('u1', datos({ claveIdempotencia: 'mobile-abc' }))
    encolarVenta('u1', datos({ claveIdempotencia: 'mobile-abc' }))
    expect(leerCola('u1')).toHaveLength(1)
  })

  it('no guarda una venta que el esquema del contrato rechaza (X5): el error sale antes, como en el alta', () => {
    const { encolarVenta, leerCola } = cargarCola()
    expect(() => encolarVenta('u1', datos({ items: [] }))).toThrow()
    expect(leerCola('u1')).toEqual([])
  })

  it('cada usuario tiene su cola: no se mandan las ventas de otro', () => {
    const { encolarVenta, leerCola } = cargarCola()
    encolarVenta('u1', datos())
    expect(leerCola('u2')).toEqual([])
    expect(leerCola(undefined)).toEqual([])
  })

  it('mantiene el orden en que se encolaron', () => {
    const { encolarVenta, leerCola } = cargarCola()
    const a = encolarVenta('u1', datos(), 2_000)
    const b = encolarVenta('u1', datos(), 1_000)
    const c = encolarVenta('u1', datos(), 3_000)
    expect(leerCola('u1').map((v) => v.clave)).toEqual([b.clave, a.clave, c.clave])
  })

  it('un dato roto en el teléfono no rompe la lectura', () => {
    mockDisco.set('ventas-sin-senal:u1', '{no es json')
    expect(cargarCola().leerCola('u1')).toEqual([])
  })

  it('las enviadas de otro día argentino se limpian; las que esperan nunca', () => {
    const { encolarVenta, cambiarEstado, limpiarEnviadasViejas, leerCola } = cargarCola()
    const ayer = Date.UTC(2026, 9, 21, 20, 0) // 17:00 del 21 en Argentina
    const hoy = Date.UTC(2026, 9, 22, 13, 0)
    const enviada = encolarVenta('u1', datos(), ayer)
    const esperando = encolarVenta('u1', datos(), ayer + 1)
    cambiarEstado('u1', enviada.clave, { tipo: 'enviada', ventaId: 'v1', codigo: 'A00419', estado: 'Confirmada' })
    limpiarEnviadasViejas('u1', hoy)
    expect(leerCola('u1').map((v) => v.clave)).toEqual([esperando.clave])
  })
})

describe('loQueVio: el precio y el total que el vendedor tenía en pantalla', () => {
  it('toma el precio del servidor de cada línea (el de oferta si hay) y el total estimado con descuento y flete', () => {
    const { loQueVio } = cargarCola()
    const { producto } = require('@/features/venta-nueva/__testing__/producto')
    const lineas = [
      { productoId: 'p1', producto: producto({ id: 'p1', precioVenta: 100 }), cantidad: 2, descuentoPct: 0 },
      { productoId: 'p2', producto: producto({ id: 'p2', precioVenta: 50, precioConOferta: 40 }), cantidad: 1, descuentoPct: 0 },
    ]
    expect(loQueVio(lineas, 10, 30)).toEqual({ precios: { p1: 100, p2: 40 }, total: 240 - 24 + 30 })
  })
})
