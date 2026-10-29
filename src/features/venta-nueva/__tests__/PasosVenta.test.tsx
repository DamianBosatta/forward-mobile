import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PasosVenta } from '../components/PasosVenta'

describe('PasosVenta: 1 · Cliente / 2 · Productos / 3 · Confirmar', () => {
  it.each([[1, 'Cliente'], [2, 'Productos'], [3, 'Confirmar']] as const)('en el paso %i marca "%s" como el actual', (paso, nombre) => {
    render(<PasosVenta paso={paso} />)
    expect(screen.getByText('1 · Cliente')).toBeTruthy()
    expect(screen.getByText('2 · Productos')).toBeTruthy()
    expect(screen.getByText('3 · Confirmar')).toBeTruthy()
    expect(screen.getByLabelText(`Paso ${paso} de 3: ${nombre}`)).toHaveProp('accessibilityState', { selected: true })
    expect(screen.getAllByLabelText(/^Paso \d de 3/).filter((n) => n.props.accessibilityState?.selected)).toHaveLength(1)
  })
})
