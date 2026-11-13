import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { PasosNumerados } from '../PasosNumerados'

const NOMBRES = ['Proveedor', 'Productos', 'Carrito', 'Recepción']

describe.each(['light', 'dark'] as const)('PasosNumerados con cuatro pasos (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('reparte el ancho en columnas iguales que no se desbordan: el último paso no queda cortado', () => {
    render(<PasosNumerados nombres={NOMBRES} paso={4} />)
    const lista = StyleSheet.flatten(screen.getByLabelText('Pasos').props.style)
    expect(lista.flexDirection).toBe('row')
    for (const [i, n] of NOMBRES.entries()) {
      const col = StyleSheet.flatten(screen.getByLabelText(`Paso ${i + 1} de 4: ${n}`).props.style)
      expect(col.flex).toBe(1)
      expect(col.minWidth).toBe(0)
      const texto = screen.getByText(n)
      expect(texto.props.numberOfLines).toBe(1)
      expect(texto.props.adjustsFontSizeToFit).toBe(true)
    }
  })

  it('marca un solo paso como actual y pone tilde en los hechos', () => {
    render(<PasosNumerados nombres={NOMBRES} paso={3} />)
    expect(screen.getAllByLabelText(/^Paso \d de 4/).filter((n) => n.props.accessibilityState?.selected)).toHaveLength(1)
    expect(screen.queryAllByText(/^\d$/)).toHaveLength(2)
  })
})
