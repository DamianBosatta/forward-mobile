import { act, renderHook } from '@testing-library/react-native'
import { olvidarFiltros, useFiltroPersistente } from '../useFiltroPersistente'

beforeEach(() => olvidarFiltros())

describe('useFiltroPersistente', () => {
  it('arranca con el valor inicial', () => {
    const { result } = renderHook(() => useFiltroPersistente('a', ''))
    expect(result.current[0]).toBe('')
  })

  it('el valor sobrevive a desmontar y volver a montar la pantalla', () => {
    const primera = renderHook(() => useFiltroPersistente('socios', ''))
    act(() => primera.result.current[1]('lavanda'))
    primera.unmount()
    const segunda = renderHook(() => useFiltroPersistente('socios', ''))
    expect(segunda.result.current[0]).toBe('lavanda')
  })

  it('limpiar vuelve al valor inicial', () => {
    const { result } = renderHook(() => useFiltroPersistente('socios', { soloVencidas: false }))
    act(() => result.current[1]({ soloVencidas: true }))
    expect(result.current[0]).toEqual({ soloVencidas: true })
    act(() => result.current[2]())
    expect(result.current[0]).toEqual({ soloVencidas: false })
  })

  it('cada pantalla tiene su clave: no se pisan', () => {
    const a = renderHook(() => useFiltroPersistente('a', ''))
    const b = renderHook(() => useFiltroPersistente('b', ''))
    act(() => a.result.current[1]('uno'))
    expect(b.result.current[0]).toBe('')
    act(() => b.result.current[1]('dos'))
    expect(a.result.current[0]).toBe('uno')
  })

  it('acepta una función como useState', () => {
    const { result } = renderHook(() => useFiltroPersistente('n', 1))
    act(() => result.current[1]((p) => p + 1))
    expect(result.current[0]).toBe(2)
  })
})
