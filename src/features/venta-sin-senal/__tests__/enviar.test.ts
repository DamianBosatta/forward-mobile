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

import { encolarVenta, leerCola, cambiarEstado } from '../lib/cola'
import { enviarPendientes } from '../lib/enviar'
import { useAuthStore } from '@/features/auth/store/auth.store'

const post = api.post as jest.Mock
const get = api.get as jest.Mock
const put = api.put as jest.Mock

let seq = 0
const alta = (extra: Partial<AltaVenta> = {}): AltaVenta => ({
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 5, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: `mobile-k${++seq}`, ...extra,
})
const encolar = (extra: Partial<AltaVenta> = {}, encoladaEn = 1_000, precios: Record<string, number> = { p1: 100 }) =>
  encolarVenta('u1', { alta: alta(extra), cliente: { direccion: 'Alem 3669' }, visto: { total: 570, precios } }, encoladaEn)

const linea = (productoId: string, precioBase: number) => ({
  productoId, productoNombre: productoId, cantidad: 6, precioLista: precioBase, precioBase, conOferta: false,
  precioEfectivo: precioBase, veredicto: 'Verde',
})
const vista = (extra: object = {}) => ({
  estadoResultante: 'Confirmada', requiereAutorizacion: false, motivos: [], rechazos: [], productosSinStock: [],
  total: 570, lineas: [linea('p1', 100)], ...extra,
})
const alta200 = (ventaId = 'v1', extra: object = {}) => ({ ventaId, version: 1, message: 'Venta creada', estado: 2, ...extra })
const detalle = (codigoPedido = 'A00419', estado = 2) => ({ venta: { id: 'v1', codigoPedido, numeroPedido: 419, estado, version: 1 } })
const sinRed = () => new TypeError('Network request failed')

/** Servidor falso por ruta: cada handler devuelve la respuesta (o tira). */
function servidor(h: { vista?: () => unknown; alta?: (cuerpo: AltaVenta) => unknown; borrador?: () => unknown; mios?: () => unknown; putBorrador?: () => unknown; detalle?: () => unknown } = {}) {
  post.mockImplementation(async (url: string, cuerpo: AltaVenta) => {
    if (url === '/api/v1/Ventas/vista-previa') return (h.vista ?? (() => vista()))()
    if (url === '/api/v1/Ventas') return (h.alta ?? (() => alta200()))(cuerpo)
    if (url === '/api/v1/Ventas/borradores') return (h.borrador ?? (() => ({ ventaId: 'b1', version: 1, message: '' })))()
    throw new Error(`POST inesperado ${url}`)
  })
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Ventas/borradores/mios') return (h.mios ?? (() => []))()
    if (url.startsWith('/api/v1/Ventas/')) return (h.detalle ?? (() => detalle()))()
    throw new Error(`GET inesperado ${url}`)
  })
  put.mockImplementation(async () => (h.putBorrador ?? (() => ({ ventaId: 'b1', version: 2, message: '' })))())
}
const llamadas = (url: string) => post.mock.calls.filter(([u]) => u === url)
const tira = (e: unknown) => () => { throw e }

const iniciarSesion = (id: string) =>
  useAuthStore.setState({ user: { id, username: id, roles: [], permissions: [] } as never })

beforeEach(() => {
  mockDisco.clear()
  jest.clearAllMocks()
  iniciarSesion('u1')
})

describe('enviar las ventas guardadas en el teléfono (V9, D4)', () => {
  it('manda la venta con la vista previa primero y queda Enviada con el código y el estado del servidor', async () => {
    servidor()
    const v = encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(llamadas('/api/v1/Ventas/vista-previa')[0][1]).toEqual(v.alta)
    expect(llamadas('/api/v1/Ventas')[0][1]).toEqual(v.alta)
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'enviada', ventaId: 'v1', codigo: 'A00419', estado: 'Confirmada' })
  })

  it('si no se puede leer el código, igual queda Enviada con el estado de la respuesta', async () => {
    servidor({ alta: () => alta200('v1', { estado: 9 }), detalle: tira(sinRed()) })
    encolar()
    await enviarPendientes('u1')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'enviada', ventaId: 'v1', codigo: null, estado: 'PendienteAutorizacion' })
  })

  it('reintenta siempre con la misma clave y, tras un intento sin respuesta, no vuelve a la vista previa', async () => {
    let n = 0
    servidor({ alta: () => { n++; if (n === 1) throw new DOMException('Aborted', 'AbortError'); return alta200('v1', { message: 'La venta ya había sido creada con esta clave de idempotencia (operación repetida).' }) } })
    const v = encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 1 })
    expect(llamadas('/api/v1/Ventas')[0][1].claveIdempotencia).toBe(v.clave)
    post.mockClear()

    // Entre los dos intentos cambió el precio: no importa, la venta pudo haberse grabado.
    servidor({ vista: () => vista({ lineas: [linea('p1', 120)] }), alta: () => alta200('v1') })
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    const claves = llamadas('/api/v1/Ventas').map(([, c]) => c.claveIdempotencia)
    expect(claves).toEqual([v.clave])
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
    expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(0)
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v1' })
  })

  it('409 ClaveIdempotenciaConOtroCuerpo: la clave ya grabó una venta, cuenta como enviada (la del servidor)', async () => {
    servidor({ alta: tira(new ApiError(409, 'otro cuerpo', [], 'ClaveIdempotenciaConOtroCuerpo', { ventaId: 'v9', version: 3, message: 'x' })) })
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v9' })
    expect(get).toHaveBeenCalledWith('/api/v1/Ventas/v9')
  })

  it('409 Duplicado (otro intento con la misma clave se está grabando): sigue esperando, sin marcarla para revisar', async () => {
    servidor({ alta: tira(new ApiError(409, 'Duplicado', [], 'Duplicado')) })
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'esperando', fase: { paso: 'altaEnviada' } })
  })

  it('un 5xx o un 401 no es un error de la venta: sigue esperando', async () => {
    servidor({ alta: tira(new ApiError(502, 'Bad gateway')) })
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    servidor({ alta: tira(new ApiError(401, 'Sesión expirada')) })
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 2 })
  })

  it('dos avisos de conexión a la vez no mandan la venta dos veces', async () => {
    let soltar!: () => void
    servidor({ alta: () => new Promise((r) => { soltar = () => r(alta200()) }) })
    encolar()
    const a = enviarPendientes('u1')
    const b = enviarPendientes('u1')
    await Promise.resolve()
    await new Promise((r) => setImmediate(r))
    soltar()
    await Promise.all([a, b])
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(1)
  })

  it('manda de a una y en el orden en que se encolaron; si se corta la señal, las de atrás esperan', async () => {
    const orden: string[] = []
    servidor({ alta: (c) => { orden.push(c.claveIdempotencia!); if (orden.length === 2) throw sinRed(); return alta200() } })
    const v1 = encolar({}, 2_000)
    const v0 = encolar({}, 1_000)
    const v2 = encolar({}, 3_000)
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(orden).toEqual([v0.clave, v1.clave])
    const estados = Object.fromEntries(leerCola('u1').map((v) => [v.clave, v.estado.tipo]))
    expect(estados).toEqual({ [v0.clave]: 'enviada', [v1.clave]: 'esperando', [v2.clave]: 'esperando' })
  })

  it('si se mata la app con el envío en vuelo, la venta sigue en el teléfono hasta que el servidor confirma', async () => {
    let cortar!: () => void
    servidor({ alta: () => new Promise((_, rechazar) => { cortar = () => rechazar(sinRed()) }) }) // no responde
    const v = encolar()
    const ronda = enviarPendientes('u1')
    await new Promise((r) => setImmediate(r))
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    // Lo que está en el disco en ese momento es lo que encuentra la app al volver a abrir.
    const guardada = JSON.parse(mockDisco.get('ventas-sin-senal:u1')!)
    expect(guardada).toEqual([expect.objectContaining({ clave: v.clave, estado: { tipo: 'esperando', fase: { paso: 'altaEnviada' }, intentos: 0 } })])
    cortar()
    await ronda
  })

  it('error de la venta (400 con código): queda para revisar con el mensaje del servidor y no se reintenta sola', async () => {
    servidor({ alta: tira(new ApiError(400, 'Falta justificar la venta sin stock.', [], 'VentaFaltaStockSinJustificacion')) })
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('completa')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'revisar', mensaje: 'Falta justificar la venta sin stock.' })
    await enviarPendientes('u1')
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
  })

  it('la vista previa trae rechazos: queda para revisar con esos mensajes, sin grabar nada', async () => {
    servidor({ vista: () => vista({ rechazos: ['El descuento supera el máximo.', 'Cliente bloqueado.'], total: null }) })
    encolar()
    await enviarPendientes('u1')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'revisar', mensaje: 'El descuento supera el máximo.\nCliente bloqueado.' })
    expect(llamadas('/api/v1/Ventas')).toHaveLength(0)
  })

  it('la vista previa rechaza la venta (403 cliente de otra cartera): para revisar', async () => {
    servidor({ vista: tira(new ApiError(403, 'El cliente no es de tu cartera.')) })
    encolar()
    await enviarPendientes('u1')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'revisar', mensaje: 'El cliente no es de tu cartera.' })
  })

  it('sin señal en la vista previa: sigue esperando en la fase nueva', async () => {
    servidor({ vista: tira(sinRed()) })
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'esperando', fase: { paso: 'nueva' }, intentos: 1 })
  })

  describe('T5b: total esperado (POST /Ventas, 409 TotalCambiado)', () => {
    const totalCambiado = (total = 600) => new ApiError(409, 'El precio cambió desde que se cargó la venta.', [], 'Desconocido', { total, lineas: [{ productoId: 'p1', precioBase: 110 }] })

    it('el alta viaja con el total que vio el vendedor, y en cada reintento con la misma clave', async () => {
      servidor({ alta: tira(sinRed()) })
      const v = encolar()
      await enviarPendientes('u1')
      servidor()
      await enviarPendientes('u1')
      const altas = llamadas('/api/v1/Ventas')
      expect(altas).toHaveLength(2)
      for (const [, cuerpo] of altas) expect(cuerpo).toMatchObject({ totalEsperado: 570, claveIdempotencia: v.clave })
    })

    it('409 TotalCambiado: la venta pasa a Borradores (Para revisar) con el total de hoy y no se reintenta', async () => {
      servidor({ alta: tira(totalCambiado(600)) })
      encolar({}, 1_000, { p1: 100 })
      await expect(enviarPendientes('u1')).resolves.toBe('completa')
      expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(1)
      expect(put).toHaveBeenCalledTimes(1)
      expect(leerCola('u1')[0].estado).toEqual({ tipo: 'enBorradores', ventaId: 'b1', totalServidor: 600 })
      await expect(enviarPendientes('u1')).resolves.toBe('vacia')
      expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    })

    it('el código ya conocido por el catálogo (TotalCambiado) también cuenta', async () => {
      servidor({ alta: tira(new ApiError(409, 'x', [], 'TotalCambiado' as never, { total: 601, lineas: [] })) })
      encolar()
      await enviarPendientes('u1')
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', totalServidor: 601 })
    })

    it('otro 409 sin esa forma sigue siendo un error de la venta: para revisar', async () => {
      servidor({ alta: tira(new ApiError(409, 'otro', [], 'Desconocido', { algo: 1 })) })
      encolar()
      await enviarPendientes('u1')
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'revisar' })
      expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(0)
    })
  })

  describe('si el precio cambió, la venta queda en Borradores para que la revises', () => {
    it('no la confirma: arma un borrador con lo que eligió el vendedor', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 120)], total: 684 }) })
      encolar({ observaciones: 'Tocar timbre', fechaEntrega: '2026-10-23' })
      await expect(enviarPendientes('u1')).resolves.toBe('completa')
      expect(llamadas('/api/v1/Ventas')).toHaveLength(0)
      expect(llamadas('/api/v1/Ventas/borradores')[0][1]).toEqual({ clienteId: 'c1', depositoId: 'd1', tipoOperacion: 'Pedido' })
      expect(put).toHaveBeenCalledWith('/api/v1/Ventas/b1', {
        id: 'b1', version: 1, descuentoGeneral: 5, metodoEntrega: 1,
        items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], fechaEntrega: '2026-10-23', observaciones: 'Tocar timbre',
      })
      expect(leerCola('u1')[0].estado).toEqual({ tipo: 'enBorradores', ventaId: 'b1', totalServidor: 684 })
    })

    it('un presupuesto va a un borrador de presupuesto', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 99.99)] }) })
      encolar({ tipoOperacion: 1 })
      await enviarPendientes('u1')
      expect(llamadas('/api/v1/Ventas/borradores')[0][1]).toMatchObject({ tipoOperacion: 'Presupuesto' })
    })

    it('un producto que el vendedor no vio con precio cuenta como cambio', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 100), linea('p2', 50)] }) })
      encolar()
      await enviarPendientes('u1')
      expect(leerCola('u1')[0].estado.tipo).toBe('enBorradores')
    })

    it('el mismo precio a menos de un centavo no es un cambio', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 100.004)] }) })
      encolar()
      await enviarPendientes('u1')
      expect(leerCola('u1')[0].estado.tipo).toBe('enviada')
    })

    it('si el alta del borrador quedó sin respuesta, al reintentar retoma ese borrador en vez de crear otro', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 120)] }), borrador: tira(sinRed()) })
      const v = encolar()
      await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
      const desde = (leerCola('u1')[0].estado as { fase: { desde: number } }).fase.desde
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'esperando', fase: { paso: 'creandoBorrador' } })

      servidor({
        mios: () => [
          { id: 'otro', version: 4, clienteId: 'c1', cantidadLineas: 3, tipoOperacion: 'Pedido', fechaModificacion: new Date(desde + 5).toISOString() },
          { id: 'b7', version: 1, clienteId: 'c1', cantidadLineas: 0, tipoOperacion: 'Pedido', fechaModificacion: new Date(desde + 5).toISOString() },
        ],
        putBorrador: () => ({ ventaId: 'b7', version: 2, message: '' }),
      })
      post.mockClear()
      await expect(enviarPendientes('u1')).resolves.toBe('completa')
      expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(0)
      expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(0)
      expect(put).toHaveBeenLastCalledWith('/api/v1/Ventas/b7', expect.objectContaining({ id: 'b7', version: 1 }))
      expect(leerCola('u1').find((x) => x.clave === v.clave)!.estado).toMatchObject({ tipo: 'enBorradores', ventaId: 'b7' })
    })

    it('si se cortó al cargar el borrador, reintenta la carga sobre el mismo borrador', async () => {
      servidor({ vista: () => vista({ lineas: [linea('p1', 120)] }), putBorrador: tira(sinRed()) })
      encolar()
      await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'esperando', fase: { paso: 'borradorCreado', ventaId: 'b1', version: 1 } })
      servidor()
      post.mockClear()
      await enviarPendientes('u1')
      expect(llamadas('/api/v1/Ventas/borradores')).toHaveLength(0)
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', ventaId: 'b1' })
    })

    it('la carga se aplicó pero no llegó la respuesta (409 de versión): relee la versión y la vuelve a cargar igual', async () => {
      let n = 0
      servidor({
        vista: () => vista({ lineas: [linea('p1', 120)] }),
        putBorrador: () => { n++; if (n === 1) throw new ApiError(409, 'La venta cambió', [], 'Concurrencia'); return { ventaId: 'b1', version: 3, message: '' } },
        detalle: () => ({ venta: { id: 'b1', version: 2, estado: 1 } }),
      })
      encolar()
      await enviarPendientes('u1')
      expect(put).toHaveBeenLastCalledWith('/api/v1/Ventas/b1', expect.objectContaining({ version: 2 }))
      expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enBorradores', ventaId: 'b1' })
    })
  })

  it('si en medio del envío entra otro usuario, no se manda nada más de la cola anterior con su sesión', async () => {
    servidor({ alta: () => { iniciarSesion('u2'); return alta200() } })
    encolar()
    encolar()
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(llamadas('/api/v1/Ventas')).toHaveLength(1)
    expect(llamadas('/api/v1/Ventas/vista-previa')).toHaveLength(1)
    const [primera, segunda] = leerCola('u1')
    expect(primera.estado.tipo).toBe('enviada')
    expect(segunda.estado).toEqual({ tipo: 'esperando', fase: { paso: 'nueva' }, intentos: 0 })
  })

  it('sin sesión del dueño de la cola no se manda nada y la cola queda igual', async () => {
    servidor()
    encolar()
    iniciarSesion('u2')
    await expect(enviarPendientes('u1')).resolves.toBe('sinSenal')
    expect(post).not.toHaveBeenCalled()
    expect(leerCola('u1')[0].estado).toEqual({ tipo: 'esperando', fase: { paso: 'nueva' }, intentos: 0 })
  })

  it('lo que ya está para revisar, en Borradores o enviado no se vuelve a mandar', async () => {
    servidor()
    const a = encolar({}, 1)
    const b = encolar({}, 2)
    const c = encolar({}, 3)
    cambiarEstado('u1', a.clave, { tipo: 'revisar', mensaje: 'x' })
    cambiarEstado('u1', b.clave, { tipo: 'enBorradores', ventaId: 'b1', totalServidor: 1 })
    cambiarEstado('u1', c.clave, { tipo: 'enviada', ventaId: 'v1', codigo: null, estado: null })
    await expect(enviarPendientes('u1')).resolves.toBe('vacia')
    expect(post).not.toHaveBeenCalled()
  })
})
