import { act, renderHook } from '@testing-library/react-native'
import { ApiError } from '@/core/api/client'
import { useAutoguardado } from '../hooks/useAutoguardado'

const sinRed = () => new TypeError('Network request failed')

function montar(guardar: jest.Mock) {
  const h = renderHook((p: { valores: { n: number } }) =>
    useAutoguardado({ borradorId: 'b1', versionInicial: 1, valores: p.valores, guardar }), { initialProps: { valores: { n: 0 } } })
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
