import React from 'react'
import { AccessibilityInfo, Animated } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { Skeleton } from '../Skeleton'
import { Esqueletos as DesdeEstados } from '../estados'
import { Esqueletos as DesdeClientes } from '@/features/clientes/components/Esqueletos'

describe.each(['light', 'dark'] as const)('Skeleton (%s)', (modo) => {
  beforeEach(() => {
    useThemeStore.setState({ mode: modo })
    jest.restoreAllMocks()
  })

  it('no reinicia el pulso al volver a renderizar (el valor animado es estable)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    const loop = jest.spyOn(Animated, 'loop')
    const { rerender } = render(<Skeleton width={100} height={20} />)
    await act(async () => { await Promise.resolve() })
    const alMontar = loop.mock.calls.length
    rerender(<Skeleton width={100} height={20} />)
    rerender(<Skeleton width={120} height={20} />)
    expect(loop.mock.calls.length).toBe(alMontar)
  })

  it('con Reduce Motion activado frena el pulso y no arranca otro', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    const stops: jest.SpyInstance[] = []
    const real = Animated.loop
    const loop = jest.spyOn(Animated, 'loop').mockImplementation((a, c) => {
      const l = real(a, c)
      stops.push(jest.spyOn(l, 'stop'))
      return l
    })
    render(<Skeleton width={100} height={20} />)
    await act(async () => { await Promise.resolve() })
    const arrancados = loop.mock.calls.length
    expect(arrancados).toBeLessThanOrEqual(1)
    stops.forEach((s) => expect(s).toHaveBeenCalled())
  })

  it('sin Reduce Motion arranca el pulso y lo deja corriendo', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    const stops: jest.SpyInstance[] = []
    const real = Animated.loop
    jest.spyOn(Animated, 'loop').mockImplementation((a, c) => {
      const l = real(a, c)
      stops.push(jest.spyOn(l, 'stop'))
      return l
    })
    render(<Skeleton width={100} height={20} />)
    await act(async () => { await Promise.resolve() })
    expect(stops).toHaveLength(1)
    expect(stops[0]).not.toHaveBeenCalled()
  })
})

describe('Esqueletos', () => {
  it('se importa desde el lugar nuevo y desde el viejo, y es el mismo componente', () => {
    expect(DesdeClientes).toBe(DesdeEstados)
  })
})
