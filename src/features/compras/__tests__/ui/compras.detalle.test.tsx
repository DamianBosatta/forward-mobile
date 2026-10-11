import React from 'react'
import { Alert } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import CompraDetailScreen from '../../../../../app/(tabs)/compras/[id]'
import { useCompra, useConfirmarCompra, useRecibirCompra, useCancelarCompra } from '@/libs/api-client'

// Errores tragados en el detalle de compra (PR 0.5): el motivo del servidor se muestra y nunca
// hay señal de éxito si la llamada falló.

const COMPRA = {
  id: 'c1',
  estado: 'NotaPedido',
  razonSocialProveedor: 'Proveedor Uno',
  nombreDeposito: 'Central',
  detalles: [],
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'c1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))

jest.mock('@/libs/api-client', () => ({
  useCompra: jest.fn(),
  useConfirmarCompra: jest.fn(),
  useRecibirCompra: jest.fn(),
  useCancelarCompra: jest.fn(),
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  return { ForwardLogo: () => <View /> }
})

const mockConfirmar = jest.fn()
const mockCancelar = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false, refetch: jest.fn(), isRefetching: false })
  ;(useConfirmarCompra as jest.Mock).mockReturnValue({ mutateAsync: mockConfirmar, isPending: false })
  ;(useRecibirCompra as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false })
  ;(useCancelarCompra as jest.Mock).mockReturnValue({ mutateAsync: mockCancelar, isPending: false })
})

it('si confirmar falla, muestra el motivo del servidor y no da señal de éxito', async () => {
  mockConfirmar.mockRejectedValue(new Error('El proveedor está bloqueado.'))
  const { getByText } = render(<CompraDetailScreen />)

  fireEvent.press(getByText('Siguiente Estado'))
  fireEvent.press(getByText('Confirmar Cambio'))

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), 'El proveedor está bloqueado.'))
  expect(Haptics.notificationAsync).not.toHaveBeenCalledWith('success')
})

it('si anular falla, muestra el motivo del servidor', async () => {
  mockCancelar.mockRejectedValue(new Error('La compra tiene pagos aplicados.'))
  const { getByLabelText } = render(<CompraDetailScreen />)

  fireEvent.press(getByLabelText('Anular orden'))
  const botones = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
  await botones.find(b => b.text === 'Sí, Anular')!.onPress!()

  expect(Alert.alert).toHaveBeenLastCalledWith(expect.any(String), 'La compra tiene pagos aplicados.')
})
