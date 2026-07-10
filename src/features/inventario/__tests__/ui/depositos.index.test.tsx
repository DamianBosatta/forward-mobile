import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import DepositosScreen from '../../../../../app/(tabs)/inventario/depositos/index'
import { useDepositos, useDeactivateDeposito } from '../../api/queries'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() })
}))

// DepositosScreen gates its content behind `isManagement` (admin/Gerencia). These tests assert
// the management view (full list + deactivate), so mock the store as a management user.
jest.mock('@/libs/store/auth.store', () => ({
  useAuthStore: () => ({
    isAdmin: () => true,
    hasRole: () => true,
  })
}))

jest.mock('@/features/inventario/api/queries', () => ({
  useDepositos: jest.fn(),
  useDeactivateDeposito: jest.fn()
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => <>{children}</>
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))

jest.mock('@/core/ui', () => {
  const React = require('react')
  const { View, Text, TouchableOpacity } = require('react-native')
  return {
    ConfirmModal: ({ visible, title, message, onConfirm, onCancel, children }: any) => visible ? (
      <View testID="confirm-modal">
        <Text>{title}</Text>
        <Text>{message}</Text>
        <TouchableOpacity onPress={onConfirm}><Text>Confirmar</Text></TouchableOpacity>
        <TouchableOpacity onPress={onCancel}><Text>Cancelar</Text></TouchableOpacity>
        {children}
      </View>
    ) : null,
    GlassCard: ({ children }: any) => <View>{children}</View>,
    ForwardLogo: () => <View />,
    TopHeaderActions: () => <View />,
    RequirePermission: ({ children }: any) => <>{children}</>
  }
})

jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0 ? ListEmptyComponent : data.map((item: any, index: number) => renderItem({ item, index }))}
      </View>
    )
  }
})

describe('DepositosScreen UI', () => {
  const mockDeactivate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useDeactivateDeposito as jest.Mock).mockReturnValue({
      mutate: mockDeactivate,
      isPending: false
    })
  })

  it('debe renderizar la lista de depósitos y sus métricas', () => {
    ;(useDepositos as jest.Mock).mockReturnValue({
      data: [
        { id: '1', nombre: 'Depósito Central', direccion: 'Dir 1', activo: true },
        { id: '2', nombre: 'Depósito Inactivo', direccion: 'Dir 2', activo: false }
      ],
      isLoading: false
    })

    const { getByText, getAllByText } = render(<DepositosScreen />)

    // Header
    expect(getByText('DEPÓSITOS')).toBeTruthy()
    
    // Lista de cards
    expect(getByText('DEPÓSITO CENTRAL')).toBeTruthy()
    expect(getByText('DEPÓSITO INACTIVO')).toBeTruthy()

    // Métricas
    expect(getByText('Total')).toBeTruthy()
    expect(getByText('2')).toBeTruthy()
    expect(getAllByText('Activos').length).toBeGreaterThan(0)
    expect(getAllByText('Inactivos').length).toBeGreaterThan(0)
  })

  it('debe mostrar mensaje si no hay resultados', () => {
    ;(useDepositos as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false
    })

    const { getByText } = render(<DepositosScreen />)
    expect(getByText('SIN RESULTADOS')).toBeTruthy()
  })

  it('debe abrir el modal de confirmación al tocar desactivar', () => {
    ;(useDepositos as jest.Mock).mockReturnValue({
      data: [
        { id: '1', nombre: 'Depósito Central', direccion: 'Dir 1', activo: true }
      ],
      isLoading: false
    })

    const { getByText } = render(<DepositosScreen />)

    // Tocar desactivar
    const btn = getByText('DESACTIVAR')
    fireEvent.press(btn, { stopPropagation: jest.fn() })

    // Se debe abrir el modal ConfirmModal
    expect(getByText('DESACTIVAR DEPÓSITO')).toBeTruthy()
    expect(getByText('¿CONFIRMÁS LA DESACTIVACIÓN DE DEPÓSITO CENTRAL? SI TIENE STOCK, DEBERÁS TRANSFERIRLO A OTRO ALMACÉN.')).toBeTruthy()
  })
})
