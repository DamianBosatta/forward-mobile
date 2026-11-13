import React from 'react'
import { AppState } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react-native'
jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
import { crearGestorStock, type ConexionStock } from '../stockEnVivo'
import { useAvisosEnVivo } from '../useAvisosEnVivo'

function conexionFalsa() {
  const h: Record<string, (...a: any[]) => void> = {}
  const c = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(true),
    on: jest.fn((e: string, cb: (...a: any[]) => void) => { h[e] = cb }),
    onreconnecting: jest.fn((cb: () => void) => { h.reconectando = cb }),
    onreconnected: jest.fn((cb: () => void) => { h.reconectada = cb }),
    onclose: jest.fn((cb: () => void) => { h.cerrada = cb }),
  }
  return { c: c as unknown as ConexionStock & typeof c, h }
}

let cambioDeEstado: (e: string) => void
const appState = AppState as unknown as { currentState: string }
const original = appState.currentState
beforeEach(() => {
  appState.currentState = 'active'
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
    cambioDeEstado = cb
    return { remove: jest.fn() }
  }) as never)
})
afterEach(() => { jest.restoreAllMocks(); appState.currentState = original })
const flush = () => new Promise<void>((r) => setImmediate(r))

describe('gestor: avisos EntidadCambio', () => {
  it('abre la conexión, entrega los avisos y no avisa reconexión en la primera conexión', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const alAvisos = jest.fn()
    const alReconectar = jest.fn()
    g.suscribirAvisos({ alAvisos, alReconectar })
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
    expect(c.on).toHaveBeenCalledWith('EntidadCambio', expect.any(Function))
    h.EntidadCambio([{ tipo: 'venta', id: 'v1' }])
    expect(alAvisos).toHaveBeenCalledWith([{ tipo: 'venta', id: 'v1' }])
    expect(alReconectar).not.toHaveBeenCalled()
  })

  it('al reconectar o al volver de segundo plano avisa una vez', async () => {
    const { c, h } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const alReconectar = jest.fn()
    g.suscribirAvisos({ alAvisos: jest.fn(), alReconectar })
    await flush()
    h.reconectada()
    await flush()
    expect(alReconectar).toHaveBeenCalledTimes(1)
    cambioDeEstado('background')
    cambioDeEstado('active')
    await flush()
    expect(alReconectar).toHaveBeenCalledTimes(2)
  })

  it('convive con stockEnVivo: la conexión sigue abierta mientras quede alguno y se suelta al irse el último', async () => {
    const { c } = conexionFalsa()
    const g = crearGestorStock(() => c)
    const bajaStock = g.suscribir(['d1'], { alConectar: jest.fn(), alCambio: jest.fn(), alEstado: jest.fn() })
    const bajaAvisos = g.suscribirAvisos({ alAvisos: jest.fn(), alReconectar: jest.fn() })
    await flush()
    expect(c.start).toHaveBeenCalledTimes(1)
    bajaStock()
    await flush()
    expect(c.stop).not.toHaveBeenCalled()
    bajaAvisos()
    await flush()
    expect(c.stop).toHaveBeenCalledTimes(1)
  })
})

describe('useAvisosEnVivo', () => {
  const montar = (activo: boolean, gestor: any) => {
    const qc = new QueryClient()
    qc.setQueryData(['ventas', 'list'], 1)
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    renderHook(() => useAvisosEnVivo(activo, gestor), { wrapper })
    return qc
  }
  const vieja = (qc: QueryClient) => qc.getQueryCache().find({ queryKey: ['ventas', 'list'] })!.state.isInvalidated

  it('con sesión suscribe; un aviso invalida por la regla central y reconectar invalida todo', async () => {
    let oyente: any
    const baja = jest.fn()
    const gestor = { suscribirAvisos: jest.fn((o) => { oyente = o; return baja }) }
    const qc = montar(true, gestor)
    expect(gestor.suscribirAvisos).toHaveBeenCalledTimes(1)
    oyente.alAvisos([{ tipo: 'venta', id: 'v1' }])
    await flush()
    expect(vieja(qc)).toBe(true)

    qc.setQueryData(['ventas', 'list'], 2)
    expect(vieja(qc)).toBe(false)
    oyente.alReconectar()
    await flush()
    expect(vieja(qc)).toBe(true)
  })

  it('sin sesión no se suscribe', () => {
    const gestor = { suscribirAvisos: jest.fn() }
    montar(false, gestor)
    expect(gestor.suscribirAvisos).not.toHaveBeenCalled()
  })
})
