import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PasosVenta } from '../components/PasosVenta'

describe('PasosVenta: Cliente / Productos / Carrito / Entrega', () => {
  it.each([[1, 'Cliente'], [2, 'Productos'], [3, 'Carrito'], [4, 'Entrega']] as const)('en el paso %i marca "%s" como el actual', (paso, nombre) => {
    render(<PasosVenta paso={paso} />)
    for (const n of ['Cliente', 'Productos', 'Carrito', 'Entrega']) expect(screen.getByText(n)).toBeTruthy()
    // Los pasos hechos llevan tilde en lugar de número; el color nunca va solo.
    expect(screen.queryAllByText(/^\d$/)).toHaveLength(4 - (paso - 1))
    expect(screen.getByLabelText(`Paso ${paso} de 4: ${nombre}`)).toHaveProp('accessibilityState', { selected: true })
    expect(screen.getAllByLabelText(/^Paso \d de 4/).filter((n) => n.props.accessibilityState?.selected)).toHaveLength(1)
  })
})
