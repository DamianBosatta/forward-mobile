import { act, renderHook } from '@testing-library/react-native'
import { ApiError } from '@/core/api/client'
import { useAutoguardado } from '../hooks/useAutoguardado'

const sinRed = () => new TypeError('Network request failed')

function montar(guardar: jest.Mock, releer?: jest.Mock) {
  const h = renderHook((p: { valores: { n: number }; id?: string }) =>
    useAutoguardado({ borradorId: 'id' in p ? p.id : 'b1', versionInicial: 1, valores: p.valores, guardar, releer }), { initialProps: { valores: { n: 0 } } as { valores: { n: number }; id?: string } })
  h.rerender({ valores: { n: 1 } })
  return h
}
const avanzar = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('autoguardado: errores de red', () => {
  it('reintenta a los 2 s, 5 s y 10 s y después queda sin guardar, con Reintentar', async () => {
    const guardar = jest.fn().mockRejectedValue(sinRed())
    const { result } = montar(guardar)
    await avanzar(800)
    expect(guardar).toHaveBeenCalledTimes(1)
    await avanzar(1999)
    expect(guardar).toHaveBeenCalledTimes(1)
    await avanzar(1)
    expect(guardar).toHaveBeenCalledTimes(2)
    await avanzar(5000)
    expect(guardar).toHaveBeenCalledTimes(3)
    await avanzar(10_000)
    expect(guardar).toHaveBeenCalledTimes(4)
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(4)
    expect(result.current.estado).toBe('error')
    expect(result.current.reintentable).toBe(true)

    guardar.mockResolvedValue(2)
    await act(async () => { result.current.reintentar() })
    await avanzar(0)
    expect(guardar).toHaveBeenCalledTimes(5)
    expect(guardar).toHaveBeenLastCalledWith({ n: 1 }, 1)
    expect(result.current.estado).toBe('guardado')
  })

  it('si un reintento sale bien, queda guardado y no vuelve a mandar', async () => {
    const guardar = jest.fn().mockRejectedValueOnce(sinRed()).mockResolvedValue(2)
    const { result } = montar(guardar)
    await avanzar(800)
    await avanzar(2000)
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(result.current.estado).toBe('guardado')
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(2)
  })

  it('un 400 no se reintenta solo ni ofrece Reintentar', async () => {
    const guardar = jest.fn().mockRejectedValue(new ApiError(400, 'El descuento supera tu tope.'))
    const { result } = montar(guardar)
    await avanzar(800)
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe('error')
    expect(result.current.reintentable).toBe(false)
  })

  it('cerrado (venta confirmada), un reintento pendiente no manda nada', async () => {
    const guardar = jest.fn().mockRejectedValue(sinRed())
    const { result } = montar(guardar)
    await avanzar(800)
    act(() => result.current.cerrar())
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})

describe('autoguardado: fallo ambiguo (el servidor pudo aplicar el PUT)', () => {
  it('si el servidor sí lo aplicó, adopta su versión: sin conflicto y guardado', async () => {
    const guardar = jest.fn().mockRejectedValueOnce(sinRed()).mockResolvedValue(9)
    const releer = jest.fn().mockResolvedValue({ version: 2, valores: { n: 1 } })
    const { result } = montar(guardar, releer)
    await avanzar(800)
    await avanzar(2000)
    expect(releer).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe('guardado')
    await expect(result.current.flush()).resolves.toBe(2)
  })

  it('si el servidor no lo aplicó, reintenta con la versión correcta', async () => {
    const guardar = jest.fn().mockRejectedValueOnce(sinRed()).mockResolvedValue(3)
    const releer = jest.fn().mockResolvedValue({ version: 1, valores: { n: 0 } })
    const { result } = montar(guardar, releer)
    await avanzar(800)
    await avanzar(2000)
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar).toHaveBeenLastCalledWith({ n: 1 }, 1)
    expect(result.current.estado).toBe('guardado')
  })

  it('si otro cambió el borrador, es un conflicto real y deja de guardar', async () => {
    const guardar = jest.fn().mockRejectedValue(sinRed())
    const releer = jest.fn().mockResolvedValue({ version: 5, valores: { n: 99 } })
    const { result } = montar(guardar, releer)
    await avanzar(800)
    await avanzar(2000)
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe('conflicto')
    await expect(result.current.flush()).rejects.toThrow()
  })

  it('un 409 tras un fallo ambiguo que no se pudo conciliar antes se relee y no es conflicto si era el propio PUT', async () => {
    const guardar = jest.fn().mockRejectedValueOnce(sinRed()).mockRejectedValueOnce(new ApiError(409, 'Conflicto'))
    const releer = jest.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValue({ version: 2, valores: { n: 1 } })
    const { result } = montar(guardar, releer)
    await avanzar(800)
    await avanzar(2000)
    expect(result.current.estado).toBe('guardado')
  })
})

describe('autoguardado: cuenta de reintentos', () => {
  it('tres ediciones durante una caída no agotan los reintentos antes de los 17 s', async () => {
    const guardar = jest.fn().mockRejectedValue(sinRed())
    const { result, rerender } = montar(guardar)
    await avanzar(800)
    expect(guardar).toHaveBeenCalledTimes(1)
    for (const n of [2, 3, 4]) {
      rerender({ valores: { n } })
      await avanzar(100)
    }
    // El debounce de la última edición vence a 1,9 s, antes de la espera: no sale nada.
    await avanzar(800)
    expect(guardar).toHaveBeenCalledTimes(1)
    // 1ª espera: 2 s desde el fallo (t = 0,8 s → 2,8 s); recién ahí sale, con lo último.
    await avanzar(900)
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar).toHaveBeenLastCalledWith({ n: 4 }, 1)
    await avanzar(5000)
    expect(guardar).toHaveBeenCalledTimes(3)
    expect(result.current.reintentable).toBe(false)
    await avanzar(10_000)
    expect(guardar).toHaveBeenCalledTimes(4)
    expect(result.current.estado).toBe('error')
  })
})

describe('autoguardado: desmontaje y sin borrador', () => {
  it('al desmontar, un reintento programado no manda nada', async () => {
    const guardar = jest.fn().mockRejectedValue(sinRed())
    const { unmount } = montar(guardar)
    await avanzar(800)
    expect(guardar).toHaveBeenCalledTimes(1)
    unmount()
    await avanzar(60_000)
    // Solo el último intento del desmontaje, sin timers vivos después.
    expect(guardar.mock.calls.length).toBeLessThanOrEqual(2)
    const llamadas = guardar.mock.calls.length
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(llamadas)
  })

  it('si se descarta el borrador, no se programa un reintento ni se guarda sin borrador', async () => {
    let soltar: (e: unknown) => void = () => undefined
    const guardar = jest.fn().mockImplementation(() => new Promise((_, rej) => { soltar = rej }))
    const { rerender } = montar(guardar)
    await avanzar(800)
    expect(guardar).toHaveBeenCalledTimes(1)
    rerender({ valores: { n: 1 }, id: undefined })
    await act(async () => soltar(sinRed()))
    await avanzar(60_000)
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})
