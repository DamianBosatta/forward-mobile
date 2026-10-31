import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Segmented } from '../index'

const OPCIONES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Como el teléfono' },
] as const

describe('Segmented: ancho por contenido', () => {
  it('los segmentos crecen sin encogerse: ninguno fuerza flex:1 ni recorta la etiqueta', () => {
    render(<Segmented accessibilityLabel="Tema" options={[...OPCIONES]} value="system" onChange={jest.fn()} />)
    for (const op of OPCIONES) {
      const seg = StyleSheet.flatten(screen.getByRole('radio', { name: op.label }).props.style)
      expect(seg.flex).toBeUndefined()
      expect(seg.flexGrow).toBe(1)
      expect(seg.flexShrink).toBe(0)
    }
  })
})
