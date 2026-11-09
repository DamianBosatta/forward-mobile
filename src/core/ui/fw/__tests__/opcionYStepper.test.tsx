import React from 'react'
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native'
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

  it('el número se puede tipear a mano (dueño 08-11): solo dígitos y sin pasar del tope', () => {
    const onChange = jest.fn()
    render(<Stepper nombre="Aceite" value={1} max={6} onChange={onChange} />)
    const campo = screen.getByLabelText('Cantidad de Aceite: 1')
    expect(campo.props.keyboardType).toBe('number-pad')
    fireEvent.changeText(campo, '4')
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.changeText(campo, '9')
    expect(onChange).toHaveBeenLastCalledWith(6)
    fireEvent.changeText(campo, '1a2')
    expect(onChange).toHaveBeenLastCalledWith(6)
    fireEvent.changeText(campo, '')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('con acotar en falso no baja lo tipeado por encima del tope y las flechas respetan el paso', async () => {
    const onChange = jest.fn()
    render(<Stepper nombre="Lavanda" etiquetaCampo="Lavanda" value={6} max={10} paso={6} acotar={false} onChange={onChange} />)
    fireEvent.changeText(screen.getByLabelText('Lavanda'), '25')
    expect(onChange).toHaveBeenLastCalledWith(25)
    await userEvent.press(screen.getByLabelText('Quitar una de Lavanda'))
    expect(onChange).toHaveBeenLastCalledWith(0)
    expect(screen.getByLabelText('Sumar una de Lavanda').props.accessibilityState.disabled).toBe(true)
  })

  it('con vacioEnCero el campo no dice 0', () => {
    render(<Stepper nombre="Lavanda" etiquetaCampo="Lavanda" value={0} max={10} vacioEnCero onChange={jest.fn()} />)
    expect(screen.getByLabelText('Lavanda').props.value).toBe('')
  })
})
