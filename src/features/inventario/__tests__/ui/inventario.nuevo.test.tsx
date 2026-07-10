import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NuevoProductoScreen from '../../../../../app/(tabs)/inventario/nuevo';
import { useProductoForm } from '../../hooks/useProductoForm';

// S4 (ADR-6): mock useAuthStore with a cost role so the full form renders.
// Tests that verify the gating logic itself live in inventario-cost-gating.test.ts.
jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      user: { roles: ['Administrador'], maxDescuentoPorcentaje: 0 },
      isAuthenticated: true,
    }
    return selector ? selector(state) : state
  }
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ dispatch: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() })
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb(),
  DrawerActions: { openDrawer: jest.fn(), closeDrawer: jest.fn() }
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));

// Mock Moti
jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  MotiText: ({ children }: any) => <>{children}</>
}));

jest.mock('../../hooks/useProductoForm', () => ({
  useProductoForm: jest.fn(),
  FRACCIONES: [{ label: 'Unidad', value: 'Unidad' }, { label: 'Pack', value: 'Pack' }],
  UBICACIONES: [{ label: 'Gondola 1', value: 'Gondola 1' }],
  fraccionWord: (f: string) => (f === 'Unidad' ? 'unidad' : 'pack'),
}));

jest.mock('@/core/ui', () => ({
  PremiumInput: ({ label, onChangeText, testID }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput accessibilityLabel={label} onChangeText={onChangeText} testID={testID || label} />;
  },
  PremiumButton: ({ title, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>;
  },
  PremiumSelect: () => null,
  ConfirmModal: () => null,
  ForwardLogo: () => null,
  GlassCard: ({ children }: any) => <>{children}</>
}));

describe('NuevoProductoScreen UI', () => {
  beforeEach(() => {
    (useProductoForm as jest.Mock).mockReturnValue({
      loadingData: false,
      isPending: false,
      nombre: '', setNombre: jest.fn(),
      descripcion: '', setDescripcion: jest.fn(),
      bultoContenido: '', setBultoContenido: jest.fn(),
      blisterContenido: '', setBlisterContenido: jest.fn(),
      fraccionMinimaVenta: 'Unidad', setFraccionMinimaVenta: jest.fn(),
      ventaMinimaUnidades: '1', setVentaMinimaUnidades: jest.fn(),
      ventaMinimaPreview: 1,
      precioCompra: '', setPrecioCompra: jest.fn(),
      margen: '20', setMargen: jest.fn(),
      ubicacion: '', setUbicacion: jest.fn(),
      stockInicial: '0', setStockInicial: jest.fn(),
      stockMinimo: '10', setStockMinimo: jest.fn(),
      precioVentaSugerido: 0,
      pickImage: jest.fn(),
      handleSubmit: jest.fn(),
      resetFormState: jest.fn(),
      modalConfig: { visible: false }
    });
  });

  it('deberia renderizar los campos principales', () => {
    const { getByLabelText } = render(<NuevoProductoScreen />);
    
    expect(getByLabelText('Nombre del Artículo')).toBeTruthy();
    expect(getByLabelText('Costo Base (ARS)')).toBeTruthy();
  });

  it('deberia invocar a handleSubmit al presionar guardar', async () => {
    const handleSubmitMock = jest.fn();
    (useProductoForm as jest.Mock).mockReturnValueOnce({
      ...jest.requireMock('../../hooks/useProductoForm').useProductoForm(),
      handleSubmit: handleSubmitMock
    });

    const { getByText } = render(<NuevoProductoScreen />);
    
    fireEvent.press(getByText('CREAR ARTÍCULO'));

    await waitFor(() => {
      expect(handleSubmitMock).toHaveBeenCalled();
    });
  });
});
