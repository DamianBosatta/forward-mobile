import React from 'react'
import { render } from '@testing-library/react-native'
import ComprasListScreen from '../../../../../app/(tabs)/compras/index'
import { useComprasList } from '../../hooks/useComprasList'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() })
}))

jest.mock('@react-navigation/native', () => ({
  DrawerActions: { openDrawer: jest.fn() }
}))

jest.mock('../../hooks/useComprasList', () => ({
  useComprasList: jest.fn()
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
  const { View, Text } = require('react-native')
  return {
    ForwardLogo: () => <View />,
    TopHeaderActions: () => <View />,
    RequirePermission: ({ children }: any) => <>{children}</>,
    GlassCard: ({ children }: any) => <View>{children}</View>,
    KpiStatRow: ({ stats }: any) => (
      <View>{stats.map((s: any) => <Text key={s.key}>{s.label}</Text>)}</View>
    ),
  }
})

jest.mock('@/core/ui/DataList', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    DataList: ({ data, renderItem, ListHeaderComponent, emptyMessage }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0 ? <Text testID="empty-message">{emptyMessage}</Text> : data.map((item: any, index: number) => renderItem({ item, index }))}
      </View>
    )
  }
})

describe('ComprasListScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('debe renderizar la lista y las metricas', () => {
    ;(useComprasList as jest.Mock).mockReturnValue({
      searchTerm: '',
      setSearchTerm: jest.fn(),
      filter: 'Todas',
      setFilter: jest.fn(),
      pickerOpen: false,
      setPickerOpen: jest.fn(),
      selected: { year: 2023, month: 10 },
      setSelected: jest.fn(),
      isCurrentMonth: true,
      now: new Date(),
      isLoading: false,
      filteredCompras: [
        { id: '1', razonSocialProveedor: 'Proveedor A', estado: '1', totalAmount: 1500, fecha: '2023-11-10T10:00:00Z' }
      ],
      totalMonto: 1500,
      pendCount: 1,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      comprasByMonth: [{}]
    })

    const { getByText } = render(<ComprasListScreen />)

    // Header
    expect(getByText('COMPRAS')).toBeTruthy()
    // KPIs
    expect(getByText('Órdenes')).toBeTruthy()
    expect(getByText('Inversión')).toBeTruthy()
    // Card item
    expect(getByText('Proveedor A')).toBeTruthy()
  })

  it('debe mostrar mensaje vacio cuando no hay ordenes', () => {
    ;(useComprasList as jest.Mock).mockReturnValue({
      searchTerm: '',
      setSearchTerm: jest.fn(),
      filter: 'Todas',
      setFilter: jest.fn(),
      pickerOpen: false,
      setPickerOpen: jest.fn(),
      selected: { year: 2023, month: 10 },
      setSelected: jest.fn(),
      isCurrentMonth: true,
      now: new Date(),
      isLoading: false,
      filteredCompras: [],
      totalMonto: 0,
      pendCount: 0,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      comprasByMonth: []
    })

    const { getByText } = render(<ComprasListScreen />)

    expect(getByText('No se encontraron órdenes de compra.')).toBeTruthy()
  })
})
