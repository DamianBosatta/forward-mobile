import { AppState } from 'react-native'
jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
import { crearGestorStock, type ConexionStock, type MensajeStock } from '../stockEnVivo'

/** Una conexión de mentira: guarda lo que se le pide y deja disparar los eventos del hub a mano. */
function conexionFalsa() {
  const h: { cambio?: (m: MensajeStock) => void; reconectando?: () => void; reconectada?: () => void; cerrada?: () => void } = {}
  const c = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(true),
    on: jest.fn((e: string, cb: (m: MensajeStock) => void) => { if (e === 'StockCambio') h.cambio = cb }),
    onreconnecting: jest.fn((cb: () => void) => { h.reconectando = cb }),
    onreconnected: jest.fn((cb: () => void) => { h.reconectada = cb }),
    onclose: jest.fn((cb: () => void) => { h.cerrada = cb }),
  }
  return { c: c as unknown as ConexionStock & typeof c, h }
}

let cambioDeEstado: (e: string) => void
const appState = AppState as unknown as { currentState: string }
const original = appState.currentState
const poner = (e: string) => { appState.currentState = e }
beforeEach(() => {
  poner('active')
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
    cambioDeEstado = cb
    return { remove: jest.fn() }
  }) as never)
})
afterEach(() => { jest.restoreAllMocks(); poner(original) })

const oyente = () => ({ alConectar: jest.fn(), alCambio: jest.fn(), alEstado: jest.fn() })
const flush = () => act0()
const act0 = () => new Promise<void>((r) => setImmediate(r))

describe('gestor de stock en vivo', () => {
  it('al suscribirse conecta y se une a cada depósito, y avisa que está en vivo', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = oyente()
    g.suscribir(['d1', 'd2'], o)
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
    expect(c.invoke).toHaveBeenCalledWith('UnirseAlDeposito', 'd1')
    expect(c.invoke).toHaveBeenCalledWith('UnirseAlDeposito', 'd2')
    expect(o.alConectar).toHaveBeenCalledTimes(1)
    expect(o.alEstado).toHaveBeenLastCalledWith(true)
  })

  it('sabe si el servidor le da cantidades (UnirseAlDeposito devuelve true) o solo el estado', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    expect(g.veCantidades()).toBe(false)
    g.suscribir(['d1'], oyente())
    await flush()
    expect(g.veCantidades()).toBe(true)
    const { c: c2 } = conexionFalsa()
    c2.invoke.mockResolvedValue(false)
    const g2 = crearGestorStock(() => c2)
    g2.suscribir(['d1'], oyente())
    await flush()
    expect(g2.veCantidades()).toBe(false)
  })

  it('pasa los avisos StockCambio al oyente', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = oyente()
    g.suscribir(['d1'], o)
    await flush()
    const msg = { depositoId: 'd1', productos: [{ productoId: 'p1', estado: 'EnAlerta' as const }] }
    h.cambio!(msg)
    expect(o.alCambio).toHaveBeenCalledWith(msg)
  })

  it('al reconectar vuelve a unirse a los depósitos y avisa para refrescar', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = oyente()
    g.suscribir(['d1'], o)
    await flush()
    c.invoke.mockClear()
    h.reconectando!()
    expect(o.alEstado).toHaveBeenLastCalledWith(false)
    h.reconectada!()
    await flush()
    expect(c.invoke).toHaveBeenCalledWith('UnirseAlDeposito', 'd1')
    expect(o.alConectar).toHaveBeenCalledTimes(2)
    expect(o.alEstado).toHaveBeenLastCalledWith(true)
  })

  it('en segundo plano suelta la conexión y al volver al primer plano conecta y se une de nuevo', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = oyente()
    g.suscribir(['d1'], o)
    await flush()
    poner('background')
    cambioDeEstado('background')
    await flush()
    expect(c.stop).toHaveBeenCalledTimes(1)
    expect(o.alEstado).toHaveBeenLastCalledWith(false)
    c.invoke.mockClear()
    poner('active')
    cambioDeEstado('active')
    await flush()
    expect(c.start).toHaveBeenCalledTimes(2)
    expect(c.invoke).toHaveBeenCalledWith('UnirseAlDeposito', 'd1')
    expect(o.alConectar).toHaveBeenCalledTimes(2)
  })

  it('al irse el último suscriptor suelta la conexión; mientras quede uno, sigue', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const a = g.suscribir(['d1'], oyente())
    const b = g.suscribir(['d1'], oyente())
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
    a()
    expect(c.stop).not.toHaveBeenCalled()
    b()
    expect(c.stop).toHaveBeenCalledTimes(1)
  })

  it('un depósito que se suma con la conexión abierta se une sin reconectar', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    g.suscribir(['d1'], oyente())
    await flush()
    c.invoke.mockClear()
    g.suscribir(['d2'], oyente())
    await flush()
    expect(c.invoke).toHaveBeenCalledTimes(1)
    expect(c.invoke).toHaveBeenCalledWith('UnirseAlDeposito', 'd2')
    expect(c.start).toHaveBeenCalledTimes(1)
  })

  it('si no pudo conectar queda sin conexión y reintentar() lo intenta de nuevo', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('sin red'))
    const g = crearGestorStock(() => c)
    const o = oyente()
    g.suscribir(['d1'], o)
    await flush()
    expect(o.alEstado).not.toHaveBeenCalledWith(true)
    expect(g.enVivo()).toBe(false)
    g.reintentar()
    await flush()
    expect(c.start).toHaveBeenCalledTimes(2)
    expect(g.enVivo()).toBe(true)
  })

  it('no conecta si la app está en segundo plano al suscribirse', async () => {
    poner('background')
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    g.suscribir(['d1'], oyente())
    await flush()
    expect(c.start).not.toHaveBeenCalled()
  })
})

describe('stock en vivo: token renovado (RED-R4-01)', () => {
  /** Un cliente de mentira de renovaciones: `renovar()` es lo que dispara el refresh exitoso del cliente HTTP. */
  function renovaciones() {
    const oyentes = new Set<() => void>()
    return {
      alRenovar: (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o) } },
      renovar: () => oyentes.forEach((o) => o()),
      cuantos: () => oyentes.size,
    }
  }

  it('una apertura fallida (401 con token vencido) se reintenta una vez al renovarse el token', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('401'))
    const r = renovaciones()
    const g = crearGestorStock(() => c, r.alRenovar)
    const o = oyente()
    g.suscribir(['d1'], o)
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
    expect(g.enVivo()).toBe(false)
    r.renovar()
    await flush()
    expect(c.start).toHaveBeenCalledTimes(2)
    expect(g.enVivo()).toBe(true)
    expect(o.alConectar).toHaveBeenCalledTimes(1)
  })

  it('con la conexión ya abierta, renovar el token no reabre nada (sin tormenta de reintentos)', async () => {
    const { c } = conexionFalsa()
    const r = renovaciones()
    const g = crearGestorStock(() => c, r.alRenovar)
    g.suscribir(['d1'], oyente())
    await flush()
    r.renovar()
    r.renovar()
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
  })

  it('tras el logout (nadie escucha) un refresh no reabre el hub y se suelta el oyente', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('401'))
    const r = renovaciones()
    const g = crearGestorStock(() => c, r.alRenovar)
    const baja = g.suscribir(['d1'], oyente())
    await flush()
    baja()
    expect(r.cuantos()).toBe(0)
    r.renovar()
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
  })
})

describe('reintento de la apertura por red o 5xx (RED-R4-01 residual)', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('reintenta con espera creciente mientras haya quien escuche, y deja de hacerlo al conectar', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('Network')).mockRejectedValueOnce(new Error('503'))
    const g = crearGestorStock(() => c, () => () => undefined)
    const o = oyente()
    g.suscribir(['d1'], o)
    await jest.advanceTimersByTimeAsync(0)
    expect(c.start).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1_999)
    expect(c.start).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1) // 2 s
    expect(c.start).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(3_999)
    expect(c.start).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(1) // 4 s después
    expect(c.start).toHaveBeenCalledTimes(3)
    expect(g.enVivo()).toBe(true)
    expect(o.alConectar).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(120_000)
    expect(c.start).toHaveBeenCalledTimes(3)
  })

  it('un 401 se reintenta, un 403 (sin permiso del hub) no y queda sin conexión (MR-R5-01)', async () => {
    const error = (statusCode: number) => Object.assign(new Error(`Status code '${statusCode}'`), { statusCode })
    const uno = conexionFalsa()
    uno.c.start.mockRejectedValueOnce(error(401))
    const g1 = crearGestorStock(() => uno.c, () => () => undefined)
    g1.suscribir(['d1'], oyente())
    await jest.advanceTimersByTimeAsync(2_000)
    expect(uno.c.start).toHaveBeenCalledTimes(2)
    expect(g1.enVivo()).toBe(true)

    const dos = conexionFalsa()
    dos.c.start.mockRejectedValue(error(403))
    const g2 = crearGestorStock(() => dos.c, () => () => undefined)
    const o = oyente()
    g2.suscribir(['d1'], o)
    await jest.advanceTimersByTimeAsync(10 * 60_000)
    expect(dos.c.start).toHaveBeenCalledTimes(1)
    expect(g2.enVivo()).toBe(false)
    g2.reintentar()
    await jest.advanceTimersByTimeAsync(0)
    expect(dos.c.start).toHaveBeenCalledTimes(2)
  })

  it('la espera tiene tope', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValue(new Error('Network'))
    const g = crearGestorStock(() => c, () => () => undefined)
    g.suscribir(['d1'], oyente())
    await jest.advanceTimersByTimeAsync(10 * 60_000)
    const antes = c.start.mock.calls.length
    await jest.advanceTimersByTimeAsync(60_000)
    expect(c.start.mock.calls.length - antes).toBe(1)
  })

  it('cuando nadie escucha deja de reintentar', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValue(new Error('Network'))
    const g = crearGestorStock(() => c, () => () => undefined)
    const baja = g.suscribir(['d1'], oyente())
    await jest.advanceTimersByTimeAsync(0)
    expect(c.start).toHaveBeenCalledTimes(1)
    baja()
    await jest.advanceTimersByTimeAsync(10 * 60_000)
    expect(c.start).toHaveBeenCalledTimes(1)
  })

  it('en segundo plano no reintenta', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValue(new Error('Network'))
    const g = crearGestorStock(() => c, () => () => undefined)
    g.suscribir(['d1'], oyente())
    await jest.advanceTimersByTimeAsync(0)
    cambioDeEstado('background')
    await jest.advanceTimersByTimeAsync(10 * 60_000)
    expect(c.start).toHaveBeenCalledTimes(1)
  })
})

describe('estado de la conexión (Conectando / En vivo / Sin conexión)', () => {
  const conexionOyente = () => ({ ...oyente(), alConexion: jest.fn() })

  it('al primer intento avisa "conectando" y al conectar "enVivo"', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = conexionOyente()
    g.suscribir(['d1'], o)
    expect(o.alConexion).toHaveBeenCalledWith('conectando')
    expect(g.conexion()).toBe('conectando')
    await flush()
    expect(o.alConexion).toHaveBeenLastCalledWith('enVivo')
    expect(g.conexion()).toBe('enVivo')
  })

  it('tras un intento fallido pasa a "sinConexion"', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('sin red'))
    const g = crearGestorStock(() => c)
    const o = conexionOyente()
    g.suscribir(['d1'], o)
    await flush()
    expect(o.alConexion).toHaveBeenLastCalledWith('sinConexion')
    expect(g.conexion()).toBe('sinConexion')
  })

  it('durante un reintento silencioso sigue en "sinConexion" (no parpadea) hasta conectar', async () => {
    const { c } = conexionFalsa()
    c.start.mockRejectedValueOnce(new Error('sin red'))
    let suelta: () => void = () => undefined
    c.start.mockImplementationOnce(() => new Promise<void>((r) => { suelta = r }))
    const g = crearGestorStock(() => c)
    const o = conexionOyente()
    g.suscribir(['d1'], o)
    await flush()
    o.alConexion.mockClear()
    g.reintentar()
    expect(g.conexion()).toBe('sinConexion')
    expect(o.alConexion).not.toHaveBeenCalled()
    suelta()
    await flush()
    expect(g.conexion()).toBe('enVivo')
  })

  it('la reconexión automática desde en vivo es "conectando"; si reconecta vuelve a "enVivo"', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = conexionOyente()
    g.suscribir(['d1'], o)
    await flush()
    h.reconectando!()
    expect(g.conexion()).toBe('conectando')
    expect(g.enVivo()).toBe(false)
    h.reconectada!()
    await flush()
    expect(g.conexion()).toBe('enVivo')
  })

  it('al cerrarse la conexión queda "sinConexion"', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const o = conexionOyente()
    g.suscribir(['d1'], o)
    await flush()
    h.cerrada!()
    expect(g.conexion()).toBe('sinConexion')
    expect(o.alConexion).toHaveBeenLastCalledWith('sinConexion')
  })

  it('un oyente que se suma después recibe el estado actual', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    g.suscribir(['d1'], conexionOyente())
    await flush()
    const tarde = conexionOyente()
    g.suscribir(['d1'], tarde)
    expect(tarde.alConexion).toHaveBeenCalledWith('enVivo')
  })
})
