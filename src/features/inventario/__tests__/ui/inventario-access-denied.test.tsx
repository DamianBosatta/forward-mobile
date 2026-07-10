import React from 'react';
import { render } from '@testing-library/react-native';
import NuevoProductoScreen from '../../../../../app/(tabs)/inventario/nuevo';
import EditarProductoScreen from '../../../../../app/(tabs)/inventario/editar/[id]';
import { useProductoForm } from '../../hooks/useProductoForm';

/**
 * S4 adversarial fix — FIX #1 render tests.
 *
 * Decision #81 / ADR-6: the product-edit screen is cost-roles only.
 * Non-cost roles (Vendedor) must receive a read-only access-denied view,
 * NOT a partially-editable form with cost fields hidden.
 *
 * These tests verify:
 *   1. Empleado on NuevoProductoScreen → access-denied banner (testID), no cost fields.
 *   2. Administrador on NuevoProductoScreen → form renders with cost field + create button.
 *   3. Empleado on EditarProductoScreen → access-denied banner (testID), no cost fields.
 *   4. Gerencia on EditarProductoScreen → form renders with cost field + save button.
 */

// ── Mutable role state used by the auth store mock ───────────────────────────
let mockRoles: string[] = ['Administrador'];

jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      user: { roles: mockRoles, maxDescuentoPorcentaje: 0 },
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  },
}));

// ── Shared module mocks ───────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'test-id-123' }),
  useNavigation: () => ({ dispatch: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => { cb(); return () => {}; },
  DrawerActions: { openDrawer: jest.fn(), closeDrawer: jest.fn() },
}));

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  MotiText: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/features/inventario/hooks/useProductoForm', () => ({
  useProductoForm: jest.fn(),
  FRACCIONES: [{ label: 'Unidad', value: 'Unidad' }, { label: 'Pack', value: 'Pack' }],
  UBICACIONES: [{ label: 'Gondola 1', value: 'Gondola 1' }],
  fraccionWord: (f: string) => (f === 'Unidad' ? 'unidad' : 'pack'),
}));

jest.mock('@/core/ui', () => ({
  PremiumInput: ({ label }: any) => {
    const { Text } = require('react-native');
    return <Text accessibilityLabel={label}>{label}</Text>;
  },
  PremiumButton: ({ title, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>;
  },
  RequirePermission: ({ children }: any) => <>{children}</>,
  PremiumSelect: () => null,
  ConfirmModal: () => null,
  ForwardLogo: () => null,
  GlassCard: ({ children }: any) => <>{children}</>,
}));

// ── Default form mock ─────────────────────────────────────────────────────────

const defaultFormMock = {
  loadingData: false,
  isPending: false,
  isUploading: false,
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
  imageUri: null, setImageUri: jest.fn(), setImageUrl: jest.fn(),
  precioVentaSugerido: 0,
  pickImage: jest.fn(),
  handleSubmit: jest.fn(),
  resetFormState: jest.fn(),
  bumpFocusKey: jest.fn(),
  queryClient: { removeQueries: jest.fn() },
  productosKeys: { detail: (id: string) => ['productos', id] },
  modalConfig: {
    visible: false, title: '', message: '', variant: 'info' as const,
    confirmLabel: '', cancelLabel: '', hideButtons: false,
    onConfirm: jest.fn(), onCancel: jest.fn(),
  },
};

beforeEach(() => {
  (useProductoForm as jest.Mock).mockReturnValue(defaultFormMock);
  mockRoles = ['Administrador']; // reset to cost role before each test
});

// ─────────────────────────────────────────────────────────────────────────────
// NuevoProductoScreen — access-denied gate
// ─────────────────────────────────────────────────────────────────────────────

describe('NuevoProductoScreen — S4 FIX #1 access-denied gate', () => {
  it('Empleado → renders access-denied banner, no cost fields, no create button', () => {
    mockRoles = ['Empleado'];
    const { queryByLabelText, queryByText, getByTestId } = render(<NuevoProductoScreen />);

    // Access-denied view must be present
    expect(getByTestId('access-denied-inventario')).toBeTruthy();

    // No cost field, no create button
    expect(queryByLabelText('Costo Base (ARS)')).toBeNull();
    expect(queryByText('CREAR ARTÍCULO')).toBeNull();
  });

  it('Administrador → renders full form with cost field and create button', () => {
    mockRoles = ['Administrador'];
    const { queryByTestId, queryByLabelText, queryByText } = render(<NuevoProductoScreen />);

    // No access-denied banner
    expect(queryByTestId('access-denied-inventario')).toBeNull();

    // Cost field and create button visible
    expect(queryByLabelText('Costo Base (ARS)')).toBeTruthy();
    expect(queryByText('CREAR ARTÍCULO')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EditarProductoScreen — access-denied gate
// ─────────────────────────────────────────────────────────────────────────────

describe('EditarProductoScreen — S4 FIX #1 access-denied gate', () => {
  it('Empleado → renders access-denied banner, no cost fields, no save button', () => {
    mockRoles = ['Empleado'];
    const { queryByLabelText, queryByText, getByTestId } = render(<EditarProductoScreen />);

    expect(getByTestId('access-denied-inventario')).toBeTruthy();
    expect(queryByLabelText('Costo Base (ARS)')).toBeNull();
    expect(queryByText('GUARDAR CAMBIOS')).toBeNull();
  });

  it('Gerencia → renders full form with cost field and save button', () => {
    mockRoles = ['Gerencia'];
    const { queryByTestId, queryByLabelText, queryByText } = render(<EditarProductoScreen />);

    expect(queryByTestId('access-denied-inventario')).toBeNull();
    expect(queryByLabelText('Costo Base (ARS)')).toBeTruthy();
    expect(queryByText('GUARDAR CAMBIOS')).toBeTruthy();
  });
});
