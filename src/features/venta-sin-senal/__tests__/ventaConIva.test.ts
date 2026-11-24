import { api, ApiError } from '@/core/api/client'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
  zustandStorage: { setItem: () => undefined, getItem: () => null, removeItem: () => undefined },
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  API_URL: '',
}))

import { cambiarEstado, encolarVenta, leerCola } from '../lib/cola'
import { encolarSiFaltaSenal } from '../lib/encolarSinSenal'
import { enviarPendientes } from '../lib/enviar'
import { useAuthStore } from '@/features/auth/store/auth.store'

const post = api.post as jest.Mock
const get = api.get as jest.Mock
const put = api.put as jest.Mock

/** Venta con factura (IVA encima del neto): el vendedor sin señal vio el NETO (100); el servidor, con señal, dice 121. */
let seq = 0
const alta = (extra: Partial<AltaVenta> = {}): AltaVenta => ({
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 1, descuentoPorcentaje: 0 }], claveIdempotencia: `mobile-iva${++seq}`, ...extra,
})
const encolar = (extra: Partial<AltaVenta> = {}, visto = 100) =>
  encolarVenta('u1', { alta: alta(extra), cliente: { direccion: 'Alem 3669' }, visto: { total: visto, precios: { p1: 100 } } }, 1_000)
const linea = (precioBase: number) => ({
  productoId: 'p1', productoNombre: 'p1', cantidad: 1, precioLista: precioBase, precioBase, conOferta: false, precioEfectivo: precioBase, veredicto: 'Verde',
})
const vista = (extra: object = {}) => ({
  estadoResultante: 'Confirmada', requiereAutorizacion: false, motivos: [], rechazos: [], productosSinStock: [],
  total: 121, totalNeto: 100, iva: 21, ivaPorAlicuota: [{ alicuota: 'Veintiuno', porcentaje: 21, neto: 100, iva: 21 }], lineas: [linea(100)], ...extra,
})
const sinRed = () => new TypeError('Network request failed')
const totalCambiado = (total: number) => new ApiError(409, 'El total cambió', undefined, 'TotalCambiado', { total, lineas: [{ productoId: 'p1', precioBase: 100 }] })

function servidor(h: { vista?: () => unknown; alta?: (c: AltaVenta) => unknown } = {}) {
  post.mockImplementation(async (url: string, cuerpo: AltaVenta) => {
    if (url === '/api/v1/Ventas/vista-previa') return (h.vista ?? (() => vista()))()
    if (url === '/api/v1/Ventas') return (h.alta ?? (() => ({ ventaId: 'v1', version: 1, message: 'ok', estado: 2 })))(cuerpo)
    if (url === '/api/v1/Ventas/borradores') return { ventaId: 'b1', version: 1, message: '' }
    throw new Error(`POST inesperado ${url}`)
  })
  get.mockImplementation(async () => ({ venta: { id: 'v1', codigoPedido: 'A1', numeroPedido: 1, estado: 2, version: 1 } }))
  put.mockImplementation(async () => ({ ventaId: 'b1', version: 2, message: '' }))
}
const llamadas = (url: string) => post.mock.calls.filter(([u]) => u === url)

beforeEach(() => {
  mockDisco.clear()
  jest.clearAllMocks()
  useAuthStore.setState({ user: { id: 'u1', username: 'u1', roles: [], permissions: [] } as never })
})

describe('venta con factura sin señal: se ve el neto y el IVA lo pone el servidor al enviar (L24)', () => {
  it('al encolarla lleva el neto que vio el vendedor como totalEsperado: nada se graba a un total que no vio (la vista previa lo ignora)', () => {
    const v = encolar({ conFactura: true })
    expect(v.alta).toMatchObject({ totalEsperado: 100 })
    expect(leerCola('u1')[0].alta).toMatchObject({ totalEsperado: 100 })
    expect(leerCola('u1')[0].visto.total).toBe(100)
  })

  it('sin el tilde nada cambia: totalEsperado = total visto, el mismo cuerpo de siempre', () => {
    const v = encolar({ conFactura: false })
    expect(v.alta).toEqual({ ...alta(), claveIdempotencia: v.clave, conFactura: false, totalEsperado: 100 })
    expect(Object.keys(v.alta).sort()).toEqual([...Object.keys(alta()), 'conFactura', 'totalEsperado'].sort())
  })

  it('al volver la señal: con los precios que vio y el mismo neto, la manda sola con totalEsperado = el total del servidor', async () => {
    servidor()
    const v = encolar({ conFactura: true })
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(llamadas('/api/v1/Ventas/vista-previa')[0][1]).not.toHaveProperty('totalEsperado')
    expect(llamadas('/api/v1/Ventas')[0][1]).toEqual({ ...v.alta, totalEsperado: 121 })
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v1', total: 121 })
  })

  it('el total se guarda con la venta ANTES del POST: si la app muere ahí, el reintento sale con el mismo cuerpo y la misma clave', async () => {
    const guardadoAntes: unknown[] = []
    servidor({ alta: () => { guardadoAntes.push(JSON.parse(JSON.stringify(leerCola('u1')[0]))); throw sinRed() } })
    const v = encolar({ conFactura: true })
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(guardadoAntes[0]).toMatchObject({ alta: { totalEsperado: 121 }, estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' } } })
    const primero = JSON.stringify(llamadas('/api/v1/Ventas')[0][1])
    post.mockClear()
    servidor()
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas').map(([, c]) => JSON.stringify(c))).toEqual([primero])
    expect(llamadas('/api/v1/Ventas')[0][1].claveIdempotencia).toBe(v.clave)
  })

  it('si el neto del servidor no es el que vio el vendedor: no se manda sola, va a Borradores', async () => {
    servidor({ vista: () => vista({ totalNeto: 110, total: 133.1, iva: 23.1 }) })
    encolar({ conFactura: true })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas')).toHaveLength(0)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', ventaId: 'b1', totalServidor: 133.1 })
  })

  it('si cambió algún precio: Borradores, igual que sin factura', async () => {
    servidor({ vista: () => vista({ lineas: [linea(120)] }) })
    encolar({ conFactura: true })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas')).toHaveLength(0)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores' })
  })

  it('un servidor que no manda totalNeto (régimen viejo): su total es el neto', async () => {
    servidor({ vista: () => vista({ total: 100, totalNeto: undefined, iva: undefined, ivaPorAlicuota: [] }) })
    encolar({ conFactura: true })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas')[0][1]).toMatchObject({ totalEsperado: 100 })
  })

  it('409 TotalCambiado al grabar (el precio se movió entre la vista previa y el alta): Borradores, sin grabar', async () => {
    servidor({ alta: () => { throw totalCambiado(130) } })
    encolar({ conFactura: true })
    await enviarPendientes('u1')
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 130 })
  })

  it('la que dejó una versión anterior de la app (con factura, totalEsperado = neto, aún sin vista previa): se manda con el total del servidor, no con el neto', async () => {
    servidor()
    const v = encolar({ conFactura: true })
    // Lo que escribía la versión anterior: el neto como totalEsperado.
    mockDisco.set('ventas-sin-senal:u1', JSON.stringify([{ ...v, alta: { ...v.alta, totalEsperado: 100 } }]))
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(llamadas('/api/v1/Ventas/vista-previa')[0][1]).not.toHaveProperty('totalEsperado')
    expect(llamadas('/api/v1/Ventas')[0][1]).toMatchObject({ totalEsperado: 121 })
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
  })

  it('la anterior que ya intentó el alta (altaEnviada, totalEsperado = neto): sale tal cual, sin vista previa; si el servidor ya la tenía queda enviada, si no cambió el total va a Borradores; nunca dos ventas', async () => {
    const v = encolar({ conFactura: true })
    const guardada = { ...v, alta: { ...v.alta, totalEsperado: 100 }, estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 1 } }
    mockDisco.set('ventas-sin-senal:u1', JSON.stringify([guardada]))
    servidor({ alta: () => ({ ventaId: 'v9', version: 1, message: 'La venta ya había sido creada con esta clave de idempotencia (operación repetida).', estado: 2 }) })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas')[0][1]).toEqual(guardada.alta)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v9' })

    mockDisco.set('ventas-sin-senal:u1', JSON.stringify([guardada]))
    post.mockClear()
    servidor({ alta: () => { throw totalCambiado(121) } })
    await enviarPendientes('u1')
    // El 409 de una con factura que no se cotizó en esta ronda: se cotiza una vez y, si el 409 sigue, Borradores.
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(1)
    expect(llamadas('/api/v1/Ventas')).toHaveLength(2)
    expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(1)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 121 })
  })
})

describe('venta con factura cuyo alta ya se intentó desde la pantalla (yaSeIntento)', () => {
  const datos = (extra: Partial<AltaVenta>) => ({ alta: alta(extra), cliente: { direccion: 'Alem 3669' }, visto: { total: 100, precios: { p1: 100 } } })

  it('queda en la cola con el mismo cuerpo del primer POST: con el total del servidor si la pantalla lo mandó', () => {
    const primerPost = { ...alta({ conFactura: true, claveIdempotencia: 'mobile-ya1' }), totalEsperado: 121 }
    const v = encolarSiFaltaSenal('u1', sinRed(), { ...datos({}), alta: primerPost })!
    expect(v.alta).toEqual(primerPost)
    expect(v.estado).toMatchObject({ fase: { paso: 'altaEnviada' } })
  })

  it('y con el neto visto si la pantalla no tenía el cálculo: el cuerpo en la cola es exactamente el que se mandó', () => {
    const primerPost = { ...alta({ conFactura: true, claveIdempotencia: 'mobile-ya2' }), totalEsperado: 100 }
    const v = encolarSiFaltaSenal('u1', sinRed(), { ...datos({}), alta: primerPost })!
    expect(JSON.stringify(v.alta)).toBe(JSON.stringify(primerPost))
  })

  it('sin el tilde sigue como siempre: totalEsperado = total visto', () => {
    const v = encolarSiFaltaSenal('u1', sinRed(), datos({ conFactura: false, claveIdempotencia: 'mobile-ya3' }))!
    expect(v.alta).toMatchObject({ totalEsperado: 100 })
  })
})

describe('venta con factura mandada con el neto: el 409 TotalCambiado se cotiza una vez (nada se graba a un total o precio que el vendedor no vio)', () => {
  /** Lo que la pantalla ya había mandado sin señal: el neto como totalEsperado, con la clave de siempre. */
  const yaMandada = (extra: Partial<AltaVenta> = {}) => {
    const primerPost = { ...alta({ conFactura: true, ...extra }), totalEsperado: 100 }
    return encolarSiFaltaSenal('u1', sinRed(), { alta: primerPost, cliente: { direccion: 'Alem 3669' }, visto: { total: 100, precios: { p1: 100 } } })!
  }
  const ok = { ventaId: 'v1', version: 1, message: 'ok', estado: 2 }
  const primeraVezCambiado = () => { let n = 0; return () => { n += 1; if (n === 1) throw totalCambiado(121); return ok } }

  it('(a)(b) precios iguales: POST con el neto, 409, vista previa, POST con 121 y la misma clave: enviada, una sola venta', async () => {
    servidor({ alta: primeraVezCambiado() })
    const v = yaMandada()
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    const posts = llamadas('/api/v1/Ventas').map(([, c]) => c)
    expect(posts).toHaveLength(2)
    expect(posts[0]).toEqual(v.alta)
    expect(posts[0].totalEsperado).toBe(100)
    expect(posts[1]).toEqual({ ...v.alta, totalEsperado: 121 })
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(1)
    expect(llamadas('/api/v1/Ventas/vista-previa')[0][1]).not.toHaveProperty('totalEsperado')
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', total: 121 })
  })

  it('(c) cambió un precio: 409, vista previa, Borradores, y nunca un POST con el precio nuevo', async () => {
    servidor({ alta: () => { throw totalCambiado(144) }, vista: () => vista({ lineas: [linea(120)], total: 145.2, totalNeto: 120, iva: 25.2 }) })
    yaMandada()
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 145.2 })
  })

  it('(d) la primera SÍ se grabó (sin IVA, se perdió la respuesta): reintento idéntico, "ya existía" da enviada, sin vista previa', async () => {
    servidor({ alta: () => ({ ventaId: 'v7', version: 1, message: 'La venta ya había sido creada con esta clave de idempotencia (operación repetida).', estado: 2 }) })
    const v = yaMandada()
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas').map(([, c]) => JSON.stringify(c))).toEqual([JSON.stringify(v.alta)])
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v7' })
  })

  it('(e) otro 409 después de cotizar de nuevo: Borradores una vez, sin ciclo', async () => {
    servidor({ alta: () => { throw totalCambiado(130) } })
    yaMandada()
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(1)
    expect(llamadas('/api/v1/Ventas')).toHaveLength(2)
    expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(1)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 130 })
  })

  it('(g) sin señal en la vista previa del medio: sigue esperando en "nueva", sin Borradores', async () => {
    servidor({ alta: () => { throw totalCambiado(121) }, vista: () => { throw sinRed() } })
    yaMandada()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'esperando', fase: { paso: 'nueva' } })
    expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(0)
  })

  it('(f) la app muere después de guardar el total: retoma con el mismo cuerpo y la misma clave, una sola venta', async () => {
    servidor({ alta: () => { throw totalCambiado(121) }, vista: () => { throw sinRed() } })
    const v = yaMandada()
    await enviarPendientes('u1')
    post.mockClear()
    // Vuelve la señal: la vista previa responde y el POST con 121 se corta.
    servidor({ alta: () => { throw sinRed() } })
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0]).toMatchObject({ alta: { totalEsperado: 121 }, estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' } } })
    const cortado = JSON.stringify(llamadas('/api/v1/Ventas')[0][1])
    post.mockClear()
    servidor({ alta: () => ok })
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas').map(([, c]) => JSON.stringify(c))).toEqual([cortado])
    expect(llamadas('/api/v1/Ventas')[0][1].claveIdempotencia).toBe(v.clave)
  })

  it('(h) la que dejó la app anterior en altaEnviada con el neto se cotiza igual que (b)', async () => {
    const v = encolar({ conFactura: true })
    mockDisco.set('ventas-sin-senal:u1', JSON.stringify([{ ...v, alta: { ...v.alta, totalEsperado: 100 }, estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 1 } }]))
    servidor({ alta: primeraVezCambiado() })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas').map(([, c]) => c.totalEsperado)).toEqual([100, 121])
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', total: 121 })
  })

  it('(i) sin el tilde el 409 va a Borradores como siempre: sin vista previa ni segundo POST', async () => {
    servidor({ alta: () => { throw totalCambiado(130) } })
    const v = encolarSiFaltaSenal('u1', sinRed(), { alta: alta({ conFactura: false }), cliente: { direccion: 'Alem 3669' }, visto: { total: 100, precios: { p1: 100 } } })!
    expect(v.alta).toMatchObject({ totalEsperado: 100 })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 130 })
  })
})

describe('cambiarEstado sigue sin tocar el cuerpo', () => {
  it('cambiar el estado no cambia el alta guardada', () => {
    const v = encolar({ conFactura: true })
    cambiarEstado('u1', v.clave, { tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 0 })
    expect(leerCola('u1')[0].alta).toEqual(v.alta)
  })
})
