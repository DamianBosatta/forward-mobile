import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { Bell } from 'lucide-react-native'
import { TopBar } from '../TopBar'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const campana = (badge?: number, onPress = jest.fn()) => ({
  icon: Bell,
  accessibilityLabel: badge ? `Avisos, ${badge} sin leer` : 'Avisos',
  onPress,
  badge,
})

describe.each(['light', 'dark'] as const)('TopBar: insignia de la campana (%s)', (modo) => {
  beforeEach(() => {
    useThemeStore.setState({ mode: modo })
  })
  it('con 0 avisos no hay pastilla', () => {
    render(<TopBar title="Hola" actions={[campana(0)]} />)
    expect(screen.queryByTestId('topbar-insignia')).toBeNull()
    expect(screen.getByRole('button', { name: 'Avisos' })).toBeTruthy()
  })

  it('con 3 avisos muestra el número y el botón lo anuncia', () => {
    render(<TopBar title="Hola" actions={[campana(3)]} />)
    expect(screen.getByTestId('topbar-insignia')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    const pastilla = StyleSheet.flatten(screen.getByTestId('topbar-insignia').props.style)
    expect(pastilla).toMatchObject({ height: 22, backgroundColor: themeColors[modo].lime })
    expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject({ color: themeColors[modo].ink })
    expect(screen.getByRole('button', { name: 'Avisos, 3 sin leer' })).toBeTruthy()
  })

  it('desde 100 muestra 99+ y hasta 99 el número entero', () => {
    const { rerender } = render(<TopBar title="Hola" actions={[campana(99)]} />)
    expect(screen.getByText('99')).toBeTruthy()
    rerender(<TopBar title="Hola" actions={[campana(120)]} />)
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it('la campana pasada como acción va después de Buscar y responde al toque', async () => {
    const onPress = jest.fn()
    render(<TopBar title="Hola" actions={[{ icon: Bell, accessibilityLabel: 'Buscar', onPress: jest.fn() }, campana(2, onPress)]} />)
    const nombres = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)
    expect(nombres.indexOf('Buscar')).toBeLessThan(nombres.indexOf('Avisos, 2 sin leer'))
    await userEvent.press(screen.getByRole('button', { name: 'Avisos, 2 sin leer' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('sin acciones, una barra no suma ninguna campana', () => {
    render(<TopBar title="Ventas" />)
    expect(screen.queryByRole('button', { name: /Avisos/ })).toBeNull()
  })
})
