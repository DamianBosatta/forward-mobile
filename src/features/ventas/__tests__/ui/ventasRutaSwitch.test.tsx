import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'

// La ruta ventas/index elige entre la lista de hoy y la nueva según el switch (PR 2.0).
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }) }))
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
jest.mock('@/features/ventas/components/VentasKpiGrid', () => ({ VentasKpiGrid: () => null }))
jest.mock('moti', () => ({ MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/features/ventas/hooks/useVentasList', () => ({
  useVentasList: () => ({
    searchTerm: '', setSearchTerm: jest.fn(), filter: 'Todas', setFilter: jest.fn(), pickerOpen: false, setPickerOpen: jest.fn(),
    selected: { year: 2026, month: 9 }, setSelected: jest.fn(), tipoOperacion: 2, setTipoOperacion: jest.fn(), isCurrentMonth: true,
    now: new Date(), isLoading: false, isRefetching: false, refetch: jest.fn(), fetchNextPage: jest.fn(), hasNextPage: false,
    isFetchingNextPage: false, rawVentas: [], filteredVentas: [], totalCount: 0, contador: null,
  }),
}))
jest.mock('@/features/ventas/components/ListaVentasNueva', () => {
  const { Text } = require('react-native')
  return { ListaVentasNueva: () => <Text>lista nueva</Text> }
})

import VentasRoute from '../../../../../app/(tabs)/ventas/index'

function loguear(roles: string[]) {
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: roles as never, permissions: [] }, isAuthenticated: true })
}

describe('ruta de ventas según el switch de la venta nueva', () => {
  it('con el switch apagado se ve la lista de hoy', () => {
    loguear(['Administrador'])
    useVentaNuevaStore.setState({ activa: false })
    render(<VentasRoute />)
    expect(screen.getByText('VENTAS')).toBeTruthy()
    expect(screen.queryByText('lista nueva')).toBeNull()
  })

  it('con el switch prendido el administrador ve la lista nueva', () => {
    loguear(['Administrador'])
    useVentaNuevaStore.setState({ activa: true })
    render(<VentasRoute />)
    expect(screen.getByText('lista nueva')).toBeTruthy()
    expect(screen.queryByText('VENTAS')).toBeNull()
  })

  it('un vendedor ve la lista de hoy aunque el switch haya quedado prendido en el teléfono', () => {
    loguear(['Vendedor'])
    useVentaNuevaStore.setState({ activa: true })
    render(<VentasRoute />)
    expect(screen.getByText('VENTAS')).toBeTruthy()
    expect(screen.queryByText('lista nueva')).toBeNull()
  })
})
