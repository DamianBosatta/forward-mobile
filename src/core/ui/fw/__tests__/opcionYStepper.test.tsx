import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { OptionCard, Stepper } from '..'

beforeEach(() => {
  useThemeStore.setState({ mode: 'light' })
})

describe('OptionCard', () => {
  it('es un radio: avisa el estado elegido y dispara onPress', async () => {
    const onPress = jest.fn()
    render(<OptionCard label="Efectivo" detail="Te dan plata" selected onPress={onPress} />)
    const op = screen.getByLabelText('Efectivo')
    expect(op.props.accessibilityRole).toBe('radio')
    expect(op.props.accessibilityState.checked).toBe(true)
    expect(screen.getByText('Te dan plata')).toBeTruthy()
    await userEvent.press(op)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('Stepper', () => {
  it('suma y quita de a uno y no pasa del tope ni baja de cero', async () => {
    const onChange = jest.fn()
    const { rerender } = render(<Stepper nombre="Aceite" value={1} max={2} onChange={onChange} />)
    await userEvent.press(screen.getByLabelText('Sumar una de Aceite'))
    expect(onChange).toHaveBeenLastCalledWith(2)
    await userEvent.press(screen.getByLabelText('Quitar una de Aceite'))
    expect(onChange).toHaveBeenLastCalledWith(0)
    onChange.mockClear()
    rerender(<Stepper nombre="Aceite" value={2} max={2} onChange={onChange} />)
    expect(screen.getByLabelText('Sumar una de Aceite').props.accessibilityState.disabled).toBe(true)
    rerender(<Stepper nombre="Aceite" value={0} max={2} onChange={onChange} />)
    expect(screen.getByLabelText('Quitar una de Aceite').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByLabelText('Cantidad de Aceite: 0')).toBeTruthy()
  })
})
