import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { FiltroChip } from '../FiltroChip'

describe('FiltroChip', () => {
  it.each([false, true])('se toca con el dedo: mide 44 de alto como mínimo (oscuro: %s)', (oscuro) => {
    render(<FiltroChip label="Hay stock" activo={false} oscuro={oscuro} onPress={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Hay stock' }).props.style).minHeight).toBeGreaterThanOrEqual(44)
  })
})
