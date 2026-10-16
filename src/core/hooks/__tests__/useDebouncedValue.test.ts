import { act, renderHook } from '@testing-library/react-native'
import { useDebouncedValue } from '../useDebouncedValue'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('devuelve el valor nuevo recién cuando deja de cambiar por el retardo', () => {
  const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 400), { initialProps: { v: 'a' } })

  rerender({ v: 'ab' })
  act(() => { jest.advanceTimersByTime(399) })
  expect(result.current).toBe('a')

  act(() => { jest.advanceTimersByTime(1) })
  expect(result.current).toBe('ab')
})

it('cada cambio reinicia la espera', () => {
  const { result, rerender } = renderHook(({ v }: { v: number }) => useDebouncedValue(v, 400), { initialProps: { v: 1 } })

  rerender({ v: 2 })
  act(() => { jest.advanceTimersByTime(300) })
  rerender({ v: 3 })
  act(() => { jest.advanceTimersByTime(300) })
  expect(result.current).toBe(1)

  act(() => { jest.advanceTimersByTime(100) })
  expect(result.current).toBe(3)
})

it('un objeto nuevo con el mismo contenido no reinicia la espera', () => {
  const { result, rerender } = renderHook(({ v }: { v: { productoId: string; cantidad: number } }) => useDebouncedValue(v, 400), {
    initialProps: { v: { productoId: 'p1', cantidad: 1 } },
  })

  rerender({ v: { productoId: 'p1', cantidad: 2 } })
  act(() => { jest.advanceTimersByTime(300) })
  rerender({ v: { productoId: 'p1', cantidad: 2 } })
  act(() => { jest.advanceTimersByTime(100) })

  expect(result.current).toEqual({ productoId: 'p1', cantidad: 2 })
})

it('sin retardo explícito espera 350 ms, como la web', () => {
  const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v), { initialProps: { v: 'a' } })

  rerender({ v: 'b' })
  act(() => { jest.advanceTimersByTime(349) })
  expect(result.current).toBe('a')
  act(() => { jest.advanceTimersByTime(1) })
  expect(result.current).toBe('b')
})
