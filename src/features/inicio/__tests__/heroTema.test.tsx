import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { HeroCargando, HeroDeInicio } from '../components/PiezasDeInicio'

const estilo = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)
const colorDe = (texto: string) => StyleSheet.flatten(screen.getByText(texto).props.style).color

describe.each(['light', 'dark'] as const)('el hero de Inicio sigue el tema (%s)', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('fondo marca-suave, cifra en el color de texto y el apoyo en el secundario del tema', () => {
    render(<HeroDeInicio testID="hero" etiqueta="Mi día" cifra="10 pendientes" meta="Todo al día." />)
    expect(estilo('hero').backgroundColor).toBe(c.brandSoft)
    expect(colorDe('10 pendientes')).toBe(c.text)
    expect(colorDe('Mi día')).toBe(c.textSecondary)
    expect(colorDe('Todo al día.')).toBe(c.textSecondary)
  })

  it('mientras carga, el mismo fondo con bloques en superficie-2 del tema', () => {
    render(<HeroCargando accessibilityLabel="Cargando Mi día" />)
    const hero = screen.getByTestId('hero-cargando')
    expect(StyleSheet.flatten(hero.props.style).backgroundColor).toBe(c.brandSoft)
    const bloques = hero.children as unknown as { props: { style: unknown } }[]
    for (const b of bloques) expect(StyleSheet.flatten(b.props.style as never).backgroundColor).toBe(c.surface2)
  })
})
