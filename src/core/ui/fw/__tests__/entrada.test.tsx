import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Entrada, entradaDe, ENTRADA } from '../Entrada'
import { StatusChip } from '../StatusChip'

describe('entradaDe', () => {
  it('no anima con Reduce Motion', () => {
    expect(entradaDe('tarjeta', 0, true)).toBeUndefined()
    expect(entradaDe('fila', 3, true)).toBeUndefined()
  })
  it('anima en filas y tarjetas sin Reduce Motion', () => {
    expect(entradaDe('fila', 2, false)).toBeDefined()
    expect(entradaDe('tarjeta', 0, false)).toBeDefined()
  })
  it('mantiene las duraciones cortas', () => {
    expect(ENTRADA.fila.duracion).toBeLessThanOrEqual(450)
    expect(ENTRADA.tarjeta.duracion).toBeLessThanOrEqual(450)
  })
})

describe('Entrada', () => {
  it('renderiza a sus hijos', () => {
    const { getByText } = render(<Entrada tipo="fila" indice={1}><Text>hola</Text></Entrada>)
    expect(getByText('hola')).toBeTruthy()
  })
})

describe('StatusChip sobreTeal', () => {
  it('conserva el estado escrito', () => {
    const { getByLabelText, getByText } = render(<StatusChip estado="entregado" label="Finalizada" sobreTeal />)
    expect(getByLabelText('Estado: Finalizada')).toBeTruthy()
    expect(getByText('Finalizada')).toBeTruthy()
  })
})
