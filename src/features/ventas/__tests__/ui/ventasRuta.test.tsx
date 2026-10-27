import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'

// La ruta ventas/index muestra la lista nueva a cualquier usuario (sin switch). El bloque Pendientes de enviar (V9) mira la conexión.
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => () => undefined) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({ canDo: () => true }),
}))
jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  const Pasa = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>
  return { ForwardLogo: Pasa, TopHeaderActions: Pasa, RequirePermission: Pasa, GlassCard: Pasa, AuroraGlow: Pasa, SegmentedControl: Pasa }
})
jest.mock('@/core/ui/DataList', () => ({ DataList: ({ ListHeaderComponent }: { ListHeaderComponent: React.ReactNode }) => <>{ListHeaderComponent}</> }))
jest.mock('@/core/ui/PremiumInput', () => ({ PremiumInput: () => null }))
jest.mock('moti', () => ({ MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/features/ventas/components/ListaVentasNueva', () => {
  const { Text } = require('react-native')
  return { ListaVentasNueva: () => <Text>lista nueva</Text> }
})

import VentasRoute from '../../../../../app/(tabs)/ventas/index'

function loguear(roles: string[]) {
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: roles as never, permissions: [] }, isAuthenticated: true })
}

describe('ruta de ventas: la lista nueva es la única, para todos', () => {
  it.each([['Vendedor'], ['Administrador']])('un %s ve la lista nueva', (rol) => {
    loguear([rol])
    render(<VentasRoute />)
    expect(screen.getByText('lista nueva')).toBeTruthy()
    expect(screen.queryByText('VENTAS')).toBeNull()
  })
})
