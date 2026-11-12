import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { ConfirmModal } from '../ConfirmModal'

const fondoDe = (texto: string) => {
  let nodo = screen.getByText(texto).parent
  while (nodo && StyleSheet.flatten(nodo.props.style)?.backgroundColor === undefined) nodo = nodo.parent
  return nodo ? StyleSheet.flatten(nodo.props.style).backgroundColor : undefined
}

describe.each(['light', 'dark'] as const)('ConfirmModal con los colores del tema (%s)', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('la tarjeta va en la superficie, cancelar en superficie-2 y anular en el rojo de peligro del tema', () => {
    render(<ConfirmModal visible title="Anular pedido" message="No se puede deshacer." confirmLabel="Anular" onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(fondoDe('Anular pedido')).toBe(c.surface)
    expect(fondoDe('Cancelar')).toBe(c.surface2)
    expect(fondoDe('Anular')).toBe(c.dangerStrong)
    expect(StyleSheet.flatten(screen.getByText('Anular').props.style).color).toBe(c.onDangerStrong)
  })
})
