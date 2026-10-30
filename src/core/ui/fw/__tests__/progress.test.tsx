import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { Progress } from '..'

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean))

const barra = () => screen.getByLabelText('Entregas hechas')
const anchoRelleno = () => flat((barra().children[0] as { props: { style: unknown } }).props.style).width

beforeEach(() => {
  useThemeStore.setState({ mode: 'light' })
})

describe('Progress', () => {
  it('expone el avance como progressbar accesible', () => {
    render(<Progress value={3} max={8} accessibilityLabel="Entregas hechas" />)
    expect(barra().props.accessibilityRole).toBe('progressbar')
    expect(barra().props.accessibilityValue).toEqual({ min: 0, max: 8, now: 3 })
  })

  it('el relleno ocupa la proporción de value sobre max', () => {
    render(<Progress value={3} max={8} accessibilityLabel="Entregas hechas" />)
    expect(anchoRelleno()).toBe('37.5%')
  })

  it('con max 0 el relleno queda vacío', () => {
    render(<Progress value={0} max={0} accessibilityLabel="Entregas hechas" />)
    expect(anchoRelleno()).toBe('0%')
  })

  it('no se pasa de los bordes', () => {
    const { rerender } = render(<Progress value={12} max={8} accessibilityLabel="Entregas hechas" />)
    expect(anchoRelleno()).toBe('100%')
    rerender(<Progress value={-2} max={8} accessibilityLabel="Entregas hechas" />)
    expect(anchoRelleno()).toBe('0%')
  })
})

describe.each(['light', 'dark'] as const)('tema %s', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('sobre superficie: pista border y relleno brand', () => {
    render(<Progress value={1} max={2} accessibilityLabel="Entregas hechas" />)
    expect(flat(barra().props.style).backgroundColor).toBe(c.border)
    expect(flat((barra().children[0] as { props: { style: unknown } }).props.style).backgroundColor).toBe(c.brand)
  })

  it('sobre la barra superior: la pista de la consola del chofer', () => {
    render(<Progress value={1} max={2} accessibilityLabel="Entregas hechas" sobreBarra />)
    expect(flat(barra().props.style).backgroundColor).toBe(modo === 'dark' ? c.border : c.textSecondary)
  })
})
