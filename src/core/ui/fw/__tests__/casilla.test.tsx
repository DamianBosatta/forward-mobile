import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { Casilla } from '..'

describe.each(['light', 'dark'] as const)('Casilla, tema %s', (modo) => {
  beforeEach(() => {
    useThemeStore.setState({ mode: modo })
  })
  const c = themeColors[modo]
  const caja = () => screen.getByTestId('casilla-caja', { includeHiddenElements: true })

  it('expone rol checkbox con su estado y mide 44 de alto como mínimo', () => {
    render(<Casilla label="Solo ocultos" marcada={false} onPress={jest.fn()} />)
    const nodo = screen.getByRole('checkbox', { name: 'Solo ocultos' })
    expect(nodo.props.accessibilityState).toEqual({ checked: false })
    expect(StyleSheet.flatten(nodo.props.style).minHeight).toBeGreaterThanOrEqual(44)
  })

  it('sin tildar: borde de 2 px borderStrong; tildada: relleno brandInk', () => {
    const { rerender } = render(<Casilla label="x" marcada={false} onPress={jest.fn()} />)
    expect(StyleSheet.flatten(caja().props.style)).toMatchObject({ borderWidth: 2, borderColor: c.borderStrong })
    rerender(<Casilla label="x" marcada onPress={jest.fn()} />)
    expect(StyleSheet.flatten(caja().props.style)).toMatchObject({ backgroundColor: c.brandInk })
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({ checked: true })
  })

  it('avisa al tocarla', () => {
    const onPress = jest.fn()
    render(<Casilla label="x" marcada={false} onPress={onPress} />)
    fireEvent.press(screen.getByRole('checkbox'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
