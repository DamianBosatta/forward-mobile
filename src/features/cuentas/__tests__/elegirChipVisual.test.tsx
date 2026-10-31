import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ElegirChip } from '../components/ElegirChip'

const opciones = [{ id: 'a', label: 'Luz' }, { id: 'b', label: 'Gas' }]

describe('ElegirChip visual (opt-in)', () => {
  it('por defecto no muestra título visible ni tilde', () => {
    render(<ElegirChip titulo="Concepto" opciones={opciones} valor="a" onCambio={() => {}} />)
    expect(screen.queryByText('Concepto')).toBeNull()
    expect(screen.queryByTestId('chip-tilde')).toBeNull()
  })

  it('con conTilde marca solo la opción elegida y con tituloVisible escribe el título', () => {
    render(<ElegirChip titulo="Concepto" tituloVisible conTilde opciones={opciones} valor="a" onCambio={() => {}} />)
    expect(screen.getByText('Concepto')).toBeTruthy()
    expect(screen.getAllByTestId('chip-tilde')).toHaveLength(1)
  })
})
