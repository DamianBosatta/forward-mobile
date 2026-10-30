import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { ArrowLeftRight } from 'lucide-react-native'
import { useThemeStore } from '@/libs/theme'
import { FilaDeAccion } from '..'

beforeEach(() => {
  useThemeStore.setState({ mode: 'light' })
})

describe('FilaDeAccion', () => {
  it('es un botón con título y subtítulo, y dispara onPress', async () => {
    const onPress = jest.fn()
    render(<FilaDeAccion icon={ArrowLeftRight} title="Transferencia entre cuentas" subtitle="Mové plata entre tus cuentas" onPress={onPress} />)
    const fila = screen.getByRole('button', { name: 'Transferencia entre cuentas' })
    expect(screen.getByText('Mové plata entre tus cuentas')).toBeTruthy()
    await userEvent.press(fila)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('deshabilitada avisa su estado y no dispara onPress', async () => {
    const onPress = jest.fn()
    render(<FilaDeAccion icon={ArrowLeftRight} title="Transferencia entre cuentas" disabled onPress={onPress} />)
    const fila = screen.getByRole('button', { name: 'Transferencia entre cuentas' })
    expect(fila.props.accessibilityState.disabled).toBe(true)
    await userEvent.press(fila)
    expect(onPress).not.toHaveBeenCalled()
  })
})
