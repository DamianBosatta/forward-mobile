import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { Fab, StatusChip, TotalsRow } from '../index2'

jest.mock('lucide-react-native', () => ({ Plus: () => null }))

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean))

beforeEach(() => {
  useThemeStore.setState({ mode: 'light' })
})

describe.each(['light', 'dark'] as const)('tema %s', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('StatusChip usa los colores del chip de ese tema', () => {
    render(<StatusChip estado="porAutorizar" />)
    const label = screen.getByText('Por autorizar')
    expect(flat(label.props.style).color).toBe(c.chip.porAutorizar.text)
    expect(flat(screen.getByLabelText('Estado: Por autorizar').props.style).backgroundColor).toBe(c.chip.porAutorizar.bg)
  })

  it('Fab usa action / onAction', () => {
    render(<Fab accessibilityLabel="Nueva venta" onPress={() => {}} />)
    expect(flat(screen.getByRole('button', { name: 'Nueva venta' }).props.style).backgroundColor).toBe(c.action)
  })
})

describe('TotalsRow', () => {
  it('formatea el importe', () => {
    render(<TotalsRow label="Subtotal" importe={48049.5} />)
    expect(screen.getByText('Subtotal')).toBeTruthy()
    expect(screen.getByText('$ 48.049,50')).toBeTruthy()
  })

  it('la variante destacada usa 20/600 para el total', () => {
    render(<TotalsRow label="Total" importe={51350.13} destacado />)
    const total = flat(screen.getByText('$ 51.350,13').props.style)
    expect(total.fontSize).toBe(20)
    expect(total.fontWeight).toBe('600')
  })
})

describe('Fab', () => {
  it('llama onPress y mide 56', () => {
    const onPress = jest.fn()
    render(<Fab accessibilityLabel="Nueva venta" onPress={onPress} />)
    const fab = screen.getByRole('button', { name: 'Nueva venta' })
    fireEvent.press(fab)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(flat(fab.props.style)).toMatchObject({ width: 56, height: 56 })
  })
})

