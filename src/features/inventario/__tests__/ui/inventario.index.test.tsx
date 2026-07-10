import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import InventarioScreen from '../../../../../app/(tabs)/inventario/index';
import { useInventarioList } from '../../hooks/useInventarioList';

// Mocks
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() })
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }));
jest.mock('expo-blur', () => ({ BlurView: ({ children }: any) => <>{children}</> }));

// Mock auth store — Vendedor role (no cost access)
jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { roles: ['Vendedor'], maxDescuentoPorcentaje: 0 },
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  },
}));

// Mock useCatalogoStock — returns empty (not relevant for these UI smoke tests)
jest.mock('@/libs/api-client/productos', () => ({
  useCatalogoStock: () => ({ data: [] }),
  CatalogoStockItem: undefined,
}));

// Mock StockDetailSheet — not relevant for these smoke tests
jest.mock('@/features/inventario/components/StockDetailSheet', () => ({
  StockDetailSheet: () => null,
}));

// Mock Moti para evitar errores de ES Modules en Jest
jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  MotiText: ({ children }: any) => <>{children}</>
}));

// Mock del hook principal
jest.mock('../../hooks/useInventarioList', () => ({
  useInventarioList: jest.fn()
}));

// Mocks UI components
jest.mock('@/core/ui', () => ({
  ForwardLogo: () => null,
  TopHeaderActions: () => null,
  RequirePermission: ({ children }: any) => <>{children}</>,
  GlassCard: ({ children }: any) => <>{children}</>,
  ConfirmModal: () => null,
  AuroraGlow: () => null,
  SegmentedControl: () => null,
  PremiumInput: ({ placeholder, onChangeText }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder={placeholder} onChangeText={onChangeText} testID="search-input" />;
  }
}));

jest.mock('@/features/inventario/components/InventoryKpiCards', () => ({
  InventoryKpiCards: () => null
}));

// Mock DataList para renderizar inmediatamente los hijos
jest.mock('@/core/ui/DataList', () => ({
  DataList: ({ data, renderItem }: any) => {
    return data.map((item: any, index: number) => renderItem({ item, index }));
  }
}));

jest.mock('@/features/inventario/components/StockCard', () => ({
  StockCard: ({ item, onOpenAjuste }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View>
        <Text>{item.nombre}</Text>
        <TouchableOpacity testID={`ajustar-${item.id}`} onPress={onOpenAjuste}>
          <Text>Ajustar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}));

jest.mock('@/features/inventario/components/StockActionModal', () => ({
  StockActionModal: ({ visible }: any) => {
    if (!visible) return null;
    const { Text } = require('react-native');
    return <Text testID="stock-modal">Modal Abierto</Text>;
  }
}));

describe('InventarioScreen UI', () => {
  beforeEach(() => {
    (useInventarioList as jest.Mock).mockReturnValue({
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
      productos: [{ id: '1', nombre: 'Producto Mock' }],
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      totalValue: 100,
      lowStockCount: 0,
      totalVirtual: 0,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false
    });
  });

  it('deberia renderizar los productos', () => {
    const { getByText } = render(<InventarioScreen />);
    expect(getByText('Producto Mock')).toBeTruthy();
  });

  it('deberia abrir el modal al tocar Ajustar', () => {
    const { getByTestId } = render(<InventarioScreen />);
    
    // Tocar el boton de ajuste
    fireEvent.press(getByTestId('ajustar-1'));

    // Verificar que el modal se renderice
    expect(getByTestId('stock-modal')).toBeTruthy();
  });

  it('deberia poder escribir en el buscador', () => {
    const setSearchTerm = jest.fn();
    (useInventarioList as jest.Mock).mockReturnValueOnce({
      ...jest.requireMock('../../hooks/useInventarioList').useInventarioList(),
      setSearchTerm
    });

    const { getByTestId } = render(<InventarioScreen />);
    
    fireEvent.changeText(getByTestId('search-input'), 'Detergente');
    expect(setSearchTerm).toHaveBeenCalledWith('Detergente');
  });
});
