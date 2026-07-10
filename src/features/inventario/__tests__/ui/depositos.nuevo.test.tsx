import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import NuevoDepositoScreen from '../../../../../app/(tabs)/inventario/depositos/nuevo'
import { useDepositoForm } from '../../hooks/useDepositoForm'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() })
}))

jest.mock('../../hooks/useDepositoForm', () => ({
  useDepositoForm: jest.fn()
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb()
}))

jest.mock('@/core/ui', () => {
  const React = require('react')
  const { View, Text, TextInput, TouchableOpacity } = require('react-native')
  return {
    ForwardLogo: () => <View />,
    PremiumInput: ({ placeholder, onChangeText, value, label }: any) => (
      <TextInput placeholder={placeholder} onChangeText={onChangeText} value={value} accessibilityLabel={label} />
    ),
    PremiumButton: ({ title, onPress }: any) => (
      <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>
    )
  }
})

describe('NuevoDepositoScreen UI', () => {
  const mockSetNombre = jest.fn()
  const mockSetDireccion = jest.fn()
  const mockHandleSubmit = jest.fn()
  const mockResetForm = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useDepositoForm as jest.Mock).mockReturnValue({
      isEdit: false,
      nombre: '',
      setNombre: mockSetNombre,
      direccion: '',
      setDireccion: mockSetDireccion,
      isPending: false,
      handleSubmit: mockHandleSubmit,
      resetForm: mockResetForm
    })
  })

  it('renderiza título para nuevo depósito', () => {
    const { getByText } = render(<NuevoDepositoScreen />)
    expect(getByText('NUEVO DEPÓSITO')).toBeTruthy()
    expect(getByText('CREAR DEPÓSITO')).toBeTruthy()
  })

  it('renderiza título de edición si isEdit es true', () => {
    ;(useDepositoForm as jest.Mock).mockReturnValue({
      isEdit: true,
      nombre: 'Editado',
      setNombre: mockSetNombre,
      direccion: 'Dir',
      setDireccion: mockSetDireccion,
      isPending: false,
      handleSubmit: mockHandleSubmit,
      resetForm: mockResetForm
    })

    const { getByText } = render(<NuevoDepositoScreen />)
    expect(getByText('EDITAR DEPÓSITO')).toBeTruthy()
    expect(getByText('GUARDAR CAMBIOS')).toBeTruthy()
  })

  it('invoca setNombre y setDireccion al escribir', () => {
    const { getByPlaceholderText } = render(<NuevoDepositoScreen />)
    
    const inputNombre = getByPlaceholderText('EJ: HUB LOGÍSTICO SUR')
    fireEvent.changeText(inputNombre, 'Depósito 1')
    expect(mockSetNombre).toHaveBeenCalledWith('Depósito 1')

    const inputDireccion = getByPlaceholderText('CALLE, NÚMERO, LOCALIDAD...')
    fireEvent.changeText(inputDireccion, 'Dirección 1')
    expect(mockSetDireccion).toHaveBeenCalledWith('Dirección 1')
  })

  it('llama a handleSubmit al guardar', () => {
    const { getByText } = render(<NuevoDepositoScreen />)
    
    const btn = getByText('CREAR DEPÓSITO')
    fireEvent.press(btn)

    expect(mockHandleSubmit).toHaveBeenCalled()
  })
})
