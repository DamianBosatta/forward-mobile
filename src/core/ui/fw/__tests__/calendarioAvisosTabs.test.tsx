import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { CalendarioAvisosTabs } from '../CalendarioAvisosTabs'

const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>

describe.each(['light', 'dark'] as const)('CalendarioAvisosTabs (%s)', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('marca la vista actual con los colores del tema y mide 44 pt', () => {
    render(<CalendarioAvisosTabs actual="avisos" sinLeer={3} onElegir={() => {}} />)
    const avisos = screen.getByRole('tab', { name: 'Avisos (3)' })
    const calendario = screen.getByRole('tab', { name: 'Calendario' })
    expect(avisos.props.accessibilityState.selected).toBe(true)
    expect(calendario.props.accessibilityState.selected).toBe(false)
    expect(estilo(avisos).backgroundColor).toBe(c.primaryBg)
    expect(estilo(calendario).backgroundColor).toBe('transparent')
    expect(estilo(avisos).minHeight).toBeGreaterThanOrEqual(44)
    expect(estilo(screen.getByTestId('vista-calendario-avisos')).backgroundColor).toBe(c.surface)
  })

  it('avisa solo al tocar la vista que no está elegida', () => {
    const onElegir = jest.fn()
    render(<CalendarioAvisosTabs actual="calendario" sinLeer={5} onElegir={onElegir} />)
    fireEvent.press(screen.getByRole('tab', { name: 'Calendario' }))
    expect(onElegir).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('tab', { name: 'Avisos (5)' }))
    expect(onElegir).toHaveBeenCalledWith('avisos')
  })

  it('sin avisos pendientes no pinta la cuenta', () => {
    render(<CalendarioAvisosTabs actual="calendario" onElegir={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Avisos' })).toBeTruthy()
  })
})
