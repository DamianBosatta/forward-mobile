import React from 'react'
import { StyleSheet } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import { PressableFx, PRESS } from '../PressableFx'

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return { ...actual, useReducedMotion: jest.fn(() => false) }
})

const reducir = (v: boolean) => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(v)

describe('PressableFx (spec FWD §6 press)', () => {
  it('el token press es escala 0.95, opacidad 0.85, 120 ms', () => {
    expect(PRESS).toEqual({ escala: 0.95, opacidad: 0.85, duracion: 120 })
  })

  it('conserva onPress, rol y estilo fijo', () => {
    reducir(false)
    const onPress = jest.fn()
    render(<PressableFx accessibilityRole="button" accessibilityLabel="Ir" onPress={onPress} style={{ height: 64 }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Ir' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Ir' }).props.style).height).toBe(64)
  })

  const escalaTras = (reduce: boolean) => {
    jest.useFakeTimers()
    reducir(reduce)
    render(<PressableFx accessibilityRole="button" accessibilityLabel="Ir" onPress={() => {}} style={{ height: 64 }} />)
    const b = screen.getByRole('button', { name: 'Ir' })
    fireEvent(b, 'pressIn')
    act(() => { jest.advanceTimersByTime(300) })
    const st = StyleSheet.flatten(screen.getByRole('button', { name: 'Ir' }).props.style)
    jest.useRealTimers()
    return st
  }

  it('sin Reduce Motion lleva el estilo animado de transform y opacity', () => {
    const st = escalaTras(false)
    expect(st.transform?.[0]).toHaveProperty('scale')
    expect(typeof st.opacity).toBe('number')
  })

  it('con Reduce Motion, al tocar no escala ni cambia la opacidad', () => {
    const st = escalaTras(true)
    expect(st.transform).toBeUndefined()
    expect(st.opacity).toBeUndefined()
  })
})
