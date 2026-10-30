import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { BusquedaBajoBarra } from '../components/BusquedaBajoBarra'
import { space, themeColors, useThemeStore } from '@/libs/theme'

describe('Stock: el buscador no queda pegado a la barra superior', () => {
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  it.each(['dark', 'light'] as const)('deja aire arriba con el tema %s y conserva el color de la barra', (modo) => {
    useThemeStore.setState({ mode: modo })
    render(<BusquedaBajoBarra value="" onChangeText={() => {}} />)
    const estilo = StyleSheet.flatten(screen.getByTestId('busqueda-bajo-barra').props.style)
    expect(estilo.paddingTop).toBe(space[3])
    expect(estilo.backgroundColor).toBe(themeColors[modo].topBar)
    expect(screen.getByLabelText('Buscar por código o nombre')).toBeTruthy()
  })
})
