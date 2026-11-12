import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { themeColors } from '@/libs/theme'
import { FiltroChip } from '../FiltroChip'

describe('FiltroChip', () => {
  it.each([false, true])('se toca con el dedo: mide 44 de alto como mínimo (oscuro: %s)', (oscuro) => {
    render(<FiltroChip label="Hay stock" activo={false} oscuro={oscuro} onPress={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Hay stock' }).props.style).minHeight).toBeGreaterThanOrEqual(44)
  })

  it('el lector oye la etiqueta propia y el rol de grupo, y el activo lleva tilde', () => {
    render(<FiltroChip label="Todos · 3" accessibilityLabel="Todos: 3" rol="radio" activo onPress={jest.fn()} />)
    const chip = screen.getByRole('radio', { name: 'Todos: 3' })
    expect(chip.props.accessibilityState).toMatchObject({ checked: true, selected: true })
    expect(screen.getByTestId('chip-tilde')).toBeTruthy()
  })

  it('el inactivo se contornea con borderStrong, no con el borde de separadores', () => {
    render(<FiltroChip label="Hay stock" activo={false} onPress={jest.fn()} />)
    const estilo = StyleSheet.flatten(screen.getByRole('button', { name: 'Hay stock' }).props.style)
    expect(estilo.borderColor).toBe(themeColors.light.borderStrong)
  })
})
