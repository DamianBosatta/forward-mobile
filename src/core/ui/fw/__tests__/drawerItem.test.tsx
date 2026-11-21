import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { DrawerItem } from '..'

describe.each(['light', 'dark'] as const)('DrawerItem (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  const fondoDe = () => StyleSheet.flatten(screen.getByRole('button').props.style).backgroundColor

  it('hija inactiva en el panel oscuro de tablet no usa surface (blanco en tema claro)', () => {
    render(<DrawerItem label="Pagos" hija oscuro onPress={() => {}} />)
    expect(fondoDe()).not.toBe(themeColors[modo].surface)
    expect(fondoDe()).toBe('transparent')
  })

  it('hija inactiva en el teléfono sigue sobre surface', () => {
    render(<DrawerItem label="Pagos" hija onPress={() => {}} />)
    expect(fondoDe()).toBe(themeColors[modo].surface)
  })
})
