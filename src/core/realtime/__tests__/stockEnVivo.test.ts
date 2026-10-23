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
    on: jest.fn((_e: string, cb: (m: MensajeStock) => void) => { h.cambio = cb }),
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
