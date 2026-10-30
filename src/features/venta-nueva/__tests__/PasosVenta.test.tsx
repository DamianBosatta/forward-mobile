import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PasosVenta } from '../components/PasosVenta'

describe('PasosVenta: Cliente / Productos / Confirmar', () => {
  it.each([[1, 'Cliente'], [2, 'Productos'], [3, 'Confirmar']] as const)('en el paso %i marca "%s" como el actual', (paso, nombre) => {
    render(<PasosVenta paso={paso} />)
    expect(screen.getByText('Cliente')).toBeTruthy()
    expect(screen.getByText('Productos')).toBeTruthy()
    expect(screen.getByText('Confirmar')).toBeTruthy()
    // Los pasos hechos llevan tilde en lugar de número; el color nunca va solo.
    expect(screen.queryAllByText(/^\d$/)).toHaveLength(3 - (paso - 1))
    expect(screen.getByLabelText(`Paso ${paso} de 3: ${nombre}`)).toHaveProp('accessibilityState', { selected: true })
    expect(screen.getAllByLabelText(/^Paso \d de 3/).filter((n) => n.props.accessibilityState?.selected)).toHaveLength(1)
  })
})
