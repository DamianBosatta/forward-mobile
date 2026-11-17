import { Alert } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

let mockPrevenir: boolean | null = null
let mockAlBloquear: ((o: { data: { action: unknown }; repeat: () => void }) => void) | null = null
const mockDisable = jest.fn()
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (prevenir: boolean, cb: typeof mockAlBloquear) => { mockPrevenir = prevenir; mockAlBloquear = cb; return mockDisable },
}))
jest.unmock('@/core/hooks/useCambiosSinGuardar')
import { useCambiosSinGuardar } from '../useCambiosSinGuardar'

type Props = { valor: unknown; opciones?: { listo?: boolean; activo?: boolean } }
const montar = (valor: unknown, opciones?: Props['opciones']) =>
  renderHook((p: Props) => useCambiosSinGuardar(p.valor, p.opciones), { initialProps: { valor, opciones } })

describe('useCambiosSinGuardar', () => {
  beforeEach(() => { mockPrevenir = null; mockAlBloquear = null; mockDisable.mockClear(); jest.restoreAllMocks() })

  it('sin tocar nada no frena la salida', () => {
    const { result } = montar({ a: '' })
    expect(result.current.hayCambios).toBe(false)
    expect(mockPrevenir).toBe(false)
  })

  it('con un cambio frena la salida y pregunta antes de descartar', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const { result, rerender } = montar({ a: '' })
    rerender({ valor: { a: 'x' } })
    expect(result.current.hayCambios).toBe(true)
    expect(mockPrevenir).toBe(true)
    const repeat = jest.fn()
    mockAlBloquear!({ data: { action: {} }, repeat })
    expect(alerta).toHaveBeenCalledWith('Salir sin guardar', 'Hay cambios sin guardar. Si salís, se pierden.', expect.any(Array))
    const botones = alerta.mock.calls[0][2]!
    expect(botones.map(b => b.text)).toEqual(['Seguir editando', 'Salir'])
    expect(repeat).not.toHaveBeenCalled()
    act(() => { botones[1].onPress!() })
    expect(repeat).toHaveBeenCalledTimes(1)
  })

  it('volver al valor original deja salir', () => {
    const { result, rerender } = montar({ a: '' })
    rerender({ valor: { a: 'x' } })
    rerender({ valor: { a: '' } })
    expect(result.current.hayCambios).toBe(false)
  })

  it('el valor de base se toma recién cuando está listo (datos del servidor)', () => {
    const { result, rerender } = montar({ a: '' }, { listo: false })
    rerender({ valor: { a: 'del servidor' }, opciones: { listo: true } })
    expect(result.current.hayCambios).toBe(false)
    rerender({ valor: { a: 'editado' }, opciones: { listo: true } })
    expect(result.current.hayCambios).toBe(true)
  })

  it('inactivo (ya se guardó) no frena', () => {
    const { rerender } = montar({ a: '' })
    rerender({ valor: { a: 'x' }, opciones: { activo: false } })
    expect(mockPrevenir).toBe(false)
  })

  it('soltar deja salir sin preguntar, para navegar tras guardar', () => {
    const { result, rerender } = montar({ a: '' })
    rerender({ valor: { a: 'x' } })
    act(() => { result.current.soltar() })
    expect(mockPrevenir).toBe(false)
    expect(mockDisable).toHaveBeenCalled()
  })
})
