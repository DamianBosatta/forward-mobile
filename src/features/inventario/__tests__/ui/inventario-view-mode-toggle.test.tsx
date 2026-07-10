/**
 * InventarioScreen — grid/list view-mode toggle tests (Slice 6, mobile).
 *
 * A separate file from inventario.index.test.tsx (which mocks SegmentedControl to
 * `null`) so this suite can use an INTERACTIVE SegmentedControl mock without touching
 * that file's existing mocks/tests.
 *
 * Asserts:
 *   - Defaults to the TARJETAS (grid/StockCard) rendering.
 *   - Tapping LISTA switches rendering to StockListRow.
 *   - The choice is persisted to MMKV storage (globally mocked in jest.setup.ts) and
 *     restored on a fresh mount.
 */

import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react-native'
import InventarioScreen from '../../../../../app/(tabs)/inventario/index'
import { useInventarioList } from '../../hooks/useInventarioList'
import { storage } from '@/core/utils/storage'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn() }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('expo-blur', () => ({ BlurView: ({ children }: any) => <>{children}</> }))

jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { roles: ['Vendedor'], maxDescuentoPorcentaje: 0 }, isAuthenticated: true }
    return selector ? selector(state) : state
  },
}))

jest.mock('@/libs/api-client/productos', () => ({
  useCatalogoStock: () => ({ data: [] }),
  CatalogoStockItem: undefined,
}))

jest.mock('@/features/inventario/components/StockDetailSheet', () => ({
  StockDetailSheet: () => null,
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  MotiText: ({ children }: any) => <>{children}</>,
}))

jest.mock('../../hooks/useInventarioList', () => ({
  useInventarioList: jest.fn(),
}))

// Interactive SegmentedControl (unlike inventario.index.test.tsx's null stub) — needed
// to actually exercise the TARJETAS/LISTA toggle in this suite.
jest.mock('@/core/ui', () => ({
  ForwardLogo: () => null,
  TopHeaderActions: () => null,
  RequirePermission: ({ children }: any) => <>{children}</>,
  GlassCard: ({ children }: any) => <>{children}</>,
  ConfirmModal: () => null,
  AuroraGlow: () => null,
  SegmentedControl: ({ options, onChange }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native')
    return (
      <View>
        {options.map((opt: string, i: number) => (
          <TouchableOpacity key={opt} testID={`segmented-${opt}`} onPress={() => onChange(i)}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  },
  PremiumInput: ({ placeholder, onChangeText }: any) => {
    const { TextInput } = require('react-native')
    return <TextInput placeholder={placeholder} onChangeText={onChangeText} testID="search-input" />
  },
}))

jest.mock('@/features/inventario/components/InventoryKpiCards', () => ({
  InventoryKpiCards: () => null,
}))

jest.mock('@/core/ui/DataList', () => ({
  DataList: ({ data, renderItem }: any) => data.map((item: any, index: number) => renderItem({ item, index })),
}))

jest.mock('@/features/inventario/components/StockCard', () => ({
  StockCard: ({ item }: any) => {
    const { Text } = require('react-native')
    return <Text testID={`stock-card-${item.id}`}>{item.nombre ?? item.producto}</Text>
  },
}))

jest.mock('@/features/inventario/components/StockListRow', () => ({
  StockListRow: ({ item }: any) => {
    const { Text } = require('react-native')
    return <Text testID={`stock-list-row-${item.id}`}>{item.nombre ?? item.producto}</Text>
  },
}))

jest.mock('@/features/inventario/components/StockActionModal', () => ({
  StockActionModal: () => null,
}))

const STORAGE_KEY = 'inventario:viewMode'

beforeEach(() => {
  storage.clearAll()
  ;(useInventarioList as jest.Mock).mockReturnValue({
    searchTerm: '',
    setSearchTerm: jest.fn(),
    depositoId: undefined,
    setDepositoId: jest.fn(),
    showDepoSelector: false,
    setShowDepoSelector: jest.fn(),
    filterIndex: 0,
    setFilterIndex: jest.fn(),
    depositos: [],
    selectedDepo: null,
    productos: [{ id: '1', producto: 'Producto Mock' }],
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
    totalValue: 100,
    lowStockCount: 0,
    totalVirtual: 0,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })
})

afterEach(() => {
  cleanup()
})

describe('InventarioScreen — view mode toggle', () => {
  it('renders StockCard (grid) by default', () => {
    const { getByTestId, queryByTestId } = render(<InventarioScreen />)
    expect(getByTestId('stock-card-1')).toBeTruthy()
    expect(queryByTestId('stock-list-row-1')).toBeNull()
  })

  it('switches to StockListRow when LISTA is tapped', () => {
    const { getByTestId, queryByTestId } = render(<InventarioScreen />)
    fireEvent.press(getByTestId('segmented-LISTA'))

    expect(getByTestId('stock-list-row-1')).toBeTruthy()
    expect(queryByTestId('stock-card-1')).toBeNull()
  })

  it('persists the LISTA choice to storage', () => {
    const { getByTestId } = render(<InventarioScreen />)
    fireEvent.press(getByTestId('segmented-LISTA'))

    expect(storage.getString(STORAGE_KEY)).toBe('list')
  })

  it('restores the LISTA view on a fresh mount when previously persisted', () => {
    storage.set(STORAGE_KEY, 'list')

    const { getByTestId, queryByTestId } = render(<InventarioScreen />)

    expect(getByTestId('stock-list-row-1')).toBeTruthy()
    expect(queryByTestId('stock-card-1')).toBeNull()
  })

  it('switching back to TARJETAS restores StockCard and updates storage', () => {
    storage.set(STORAGE_KEY, 'list')
    const { getByTestId, queryByTestId } = render(<InventarioScreen />)

    fireEvent.press(getByTestId('segmented-TARJETAS'))

    expect(getByTestId('stock-card-1')).toBeTruthy()
    expect(queryByTestId('stock-list-row-1')).toBeNull()
    expect(storage.getString(STORAGE_KEY)).toBe('grid')
  })
})
