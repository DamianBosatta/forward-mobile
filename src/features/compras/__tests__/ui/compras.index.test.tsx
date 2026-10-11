import React from 'react'
import { render } from '@testing-library/react-native'
import ComprasListScreen from '../../../../../app/(tabs)/compras/index'
import { useComprasList } from '../../hooks/useComprasList'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() })
}))

jest.mock('@react-navigation/native', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
}))

jest.mock('../../hooks/useComprasList', () => ({
  useComprasList: jest.fn()
}))

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))

jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: any) => <>{children}</>,
  usePermissions: () => ({ canDo: () => true }),
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

const conAncho = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })

describe('ComprasListScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    conAncho(390)
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
      pendCount: 1,
      totalCount: 137,
      contador: 'Mostrando 40 de 137',
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      comprasByMonth: [{}]
    })

    const { getByText, queryByText } = render(<ComprasListScreen />)

    // Header
    expect(getByText('COMPRAS')).toBeTruthy()
    // KPIs
    expect(getByText('Órdenes')).toBeTruthy()
    expect(queryByText('Inversión')).toBeNull()
    expect(getByText('Pendientes')).toBeTruthy()
    expect(getByText('Mostrando 40 de 137')).toBeTruthy()
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
      pendCount: 0,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      comprasByMonth: []
    })

    const { getByText } = render(<ComprasListScreen />)

    expect(getByText('No se encontraron órdenes de compra.')).toBeTruthy()
  })

  it.each([
    [390, 'teléfono', 0],
    [1194, 'tablet', 1],
  ])('en %i px (%s) hay un solo "+" para crear una compra (botón propio: %i)', (ancho, _nombre, propios) => {
    conAncho(ancho)
    ;(useComprasList as jest.Mock).mockReturnValue({
      searchTerm: '', setSearchTerm: jest.fn(), filter: 'Todas', setFilter: jest.fn(),
      pickerOpen: false, setPickerOpen: jest.fn(), selected: { year: 2023, month: 10 }, setSelected: jest.fn(),
      isCurrentMonth: true, now: new Date(), isLoading: false, filteredCompras: [], totalMonto: 0, pendCount: 0,
      fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false, comprasByMonth: [],
    })

    const { getAllByLabelText, queryByLabelText, queryAllByTestId } = render(<ComprasListScreen />)

    expect(queryAllByTestId('fab-nueva-compra')).toHaveLength(propios)
    expect(getAllByLabelText('Nueva compra')).toHaveLength(1)
    expect(queryByLabelText('Nueva venta')).toBeNull()
  })
})
