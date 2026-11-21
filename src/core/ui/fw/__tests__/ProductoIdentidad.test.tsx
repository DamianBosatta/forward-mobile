import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ProductoIdentidad } from '../ProductoIdentidad'
import { StyleSheet } from 'react-native'
import { themeColors, useThemeStore } from '@/libs/theme'

describe.each(['light', 'dark'] as const)('ProductoIdentidad (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('muestra marca, nombre y código', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas del Sur" codigo="LAV-01" />)
    expect(screen.getByText('Esencia Lavanda')).toBeTruthy()
    expect(screen.getByText('Aromas del Sur')).toBeTruthy()
    expect(screen.getByText('LAV-01')).toBeTruthy()
  })

  it('sin marca no hay renglón de marca', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca={null} codigo="LAV-01" />)
    expect(screen.queryByText('Aromas del Sur')).toBeNull()
    expect(screen.getByText('Esencia Lavanda')).toBeTruthy()
  })

  it('sin código (vacío o nulo) no hay insignia', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas" codigo="  " />)
    expect(screen.queryByLabelText(/^Código/)).toBeNull()
  })
  it('sobreTeal pone toda la tipografía en ink (legible sobre la tarjeta teal en los dos temas)', () => {
    const c = themeColors[modo]
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas del Sur" codigo="LAV-01" sobreTeal />)
    for (const t of ['Esencia Lavanda', 'Aromas del Sur', 'LAV-01']) {
      expect(StyleSheet.flatten(screen.getByText(t).props.style).color).toBe(c.ink)
    }
  })

  it('por defecto conserva los colores de siempre', () => {
    const c = themeColors[modo]
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas del Sur" codigo="LAV-01" />)
    expect(StyleSheet.flatten(screen.getByText('Esencia Lavanda').props.style).color).toBe(c.text)
  })
})
