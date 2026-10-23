import { AppState } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'
import { useStockEnVivo, REFRESCO_SIN_CONEXION_MS } from '../useStockEnVivo'
import type { GestorStock, OyenteStock } from '../stockEnVivo'

jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

/** Un gestor de mentira: guarda al oyente para dispararle conexión, corte y avisos. */
function gestorFalso() {
  const g = { oyente: null as OyenteStock | null, ids: [] as string[], baja: jest.fn(), reintentar: jest.fn() }
  const gestor = {
    suscribir: jest.fn((ids: string[], o: OyenteStock) => { g.oyente = o; g.ids = ids; return g.baja }),
    reintentar: g.reintentar,
    enVivo: () => false,
  } as unknown as GestorStock
  return { g, gestor }
}

const oyentesDeApp = new Set<(e: string) => void>()
const cambioDeEstado = (e: string) => oyentesDeApp.forEach((cb) => cb(e))
beforeEach(() => {
  jest.useFakeTimers()
  oyentesDeApp.clear()
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
    oyentesDeApp.add(cb)
    return { remove: () => oyentesDeApp.delete(cb) }
  }) as never)
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('useStockEnVivo', () => {
  it('suscribe a los depósitos y se da de baja al desmontar', () => {
    const { g, gestor } = gestorFalso()
    const { unmount } = renderHook(() => useStockEnVivo({ depositoIds: ['d1'], alRefrescar: jest.fn(), gestor }))
    expect(g.ids).toEqual(['d1'])
    unmount()
    expect(g.baja).toHaveBeenCalledTimes(1)
  })

  it('indica "en vivo" según la conexión y refresca al conectar', () => {
    const { g, gestor } = gestorFalso()
    const alRefrescar = jest.fn()
    const { result } = renderHook(() => useStockEnVivo({ depositoIds: ['d1'], alRefrescar, gestor }))
    expect(result.current.enVivo).toBe(false)
    act(() => { g.oyente!.alEstado(true); g.oyente!.alConectar() })
    expect(result.current.enVivo).toBe(true)
    expect(alRefrescar).toHaveBeenCalledTimes(1)
    act(() => g.oyente!.alEstado(false))
    expect(result.current.enVivo).toBe(false)
  })

  it('pasa los avisos al callback', () => {
    const { g, gestor } = gestorFalso()
    const alCambio = jest.fn()
    renderHook(() => useStockEnVivo({ depositoIds: ['d1'], alRefrescar: jest.fn(), alCambio, gestor }))
    const m = { depositoId: 'd1', productos: [{ productoId: 'p1', estado: 'SinStock' as const }] }
    act(() => g.oyente!.alCambio(m))
    expect(alCambio).toHaveBeenCalledWith(m)
  })

  it('sin conexión refresca cada 30 s y reintenta conectar; con conexión no', () => {
    const { g, gestor } = gestorFalso()
    const alRefrescar = jest.fn()
    renderHook(() => useStockEnVivo({ depositoIds: ['d1'], alRefrescar, gestor }))
    act(() => { jest.advanceTimersByTime(REFRESCO_SIN_CONEXION_MS) })
    expect(alRefrescar).toHaveBeenCalledTimes(1)
    expect(g.reintentar).toHaveBeenCalledTimes(1)
    act(() => { g.oyente!.alEstado(true) })
    alRefrescar.mockClear()
    act(() => { jest.advanceTimersByTime(REFRESCO_SIN_CONEXION_MS * 3) })
    expect(alRefrescar).not.toHaveBeenCalled()
  })

  it('sin conexión refresca al volver al primer plano; con conexión no (lo hace al reconectar)', () => {
    const { g, gestor } = gestorFalso()
    const alRefrescar = jest.fn()
    renderHook(() => useStockEnVivo({ depositoIds: ['d1'], alRefrescar, gestor }))
    act(() => cambioDeEstado('active'))
    expect(alRefrescar).toHaveBeenCalledTimes(1)
    act(() => { g.oyente!.alEstado(true) })
    alRefrescar.mockClear()
    act(() => cambioDeEstado('active'))
    expect(alRefrescar).not.toHaveBeenCalled()
  })
})
