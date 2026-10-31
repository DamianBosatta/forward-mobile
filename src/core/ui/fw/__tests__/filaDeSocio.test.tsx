import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { FilaDeSocio } from '../FilaDeSocio'

describe('FilaDeSocio', () => {
  it('con onPress es un botón que responde al toque', async () => {
    const onPress = jest.fn()
    render(<FilaDeSocio titulo="Molinos SA" accessibilityLabel="Molinos SA" onPress={onPress} />)
    await userEvent.press(screen.getByRole('button', { name: 'Molinos SA' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('sin onPress es una fila de solo lectura: no es un botón y muestra título, derecha y línea 2', () => {
    render(<FilaDeSocio titulo="Molinos SA" derecha={<>{'$ 10'}</>} linea2="CUIT 30-1-2" accessibilityLabel="Molinos SA, le debés $ 10" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByLabelText('Molinos SA, le debés $ 10')).toBeTruthy()
    expect(screen.getByText('Molinos SA')).toBeTruthy()
    expect(screen.getByText('CUIT 30-1-2')).toBeTruthy()
  })

  it('chevron muestra la flecha al final; sin la prop no hay flecha', () => {
    const { rerender } = render(<FilaDeSocio titulo="Molinos SA" accessibilityLabel="Molinos SA" onPress={jest.fn()} />)
    expect(screen.queryByTestId('fila-de-socio-chevron')).toBeNull()
    rerender(<FilaDeSocio titulo="Molinos SA" accessibilityLabel="Molinos SA" onPress={jest.fn()} chevron />)
    expect(screen.getAllByTestId('fila-de-socio-chevron').length).toBeGreaterThan(0)
  })
})
