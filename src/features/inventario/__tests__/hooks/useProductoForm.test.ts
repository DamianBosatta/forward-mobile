import { renderHook, act } from '@testing-library/react-native';
import { useProductoForm } from '../../hooks/useProductoForm';

// Mocks
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() })
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn()
}));

const mockMutateAsyncCreate = jest.fn();
const mockMutateAsyncUpdate = jest.fn();

jest.mock('../../api/queries', () => ({
  useProducto: jest.fn(() => ({ data: null, isLoading: false })),
  useCreateProducto: jest.fn(() => ({ mutateAsync: mockMutateAsyncCreate, isPending: false })),
  useUpdateProducto: jest.fn(() => ({ mutateAsync: mockMutateAsyncUpdate, isPending: false })),
  productosKeys: {}
}));

describe('useProductoForm Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deberia calcular correctamente el precio de venta sugerido', () => {
    const { result } = renderHook(() => useProductoForm());

    act(() => {
      result.current.setPrecioCompra('100'); // Costo 100
      result.current.setMargen('20'); // Margen 20%
    });

    // Costo / (1 - Margen/100) => 100 / 0.8 = 125
    expect(result.current.precioVentaSugerido).toBe(125);
  });

  it('deberia mostrar modal de error si faltan campos obligatorios', async () => {
    const { result } = renderHook(() => useProductoForm());

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.modalConfig.visible).toBe(true);
    expect(result.current.modalConfig.title).toBe('Campos requeridos');
    expect(mockMutateAsyncCreate).not.toHaveBeenCalled();
  });

  it('deberia llamar a createProducto en modo creacion con datos validos', async () => {
    const { result } = renderHook(() => useProductoForm());

    await act(async () => {
      result.current.setNombre('Producto Test');
      result.current.setPrecioCompra('100');
      result.current.setMargen('20');
    });

    mockMutateAsyncCreate.mockResolvedValueOnce({});

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMutateAsyncCreate).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Producto Test',
      precioCompraBase: 100,
      margenGanancia: 0.2
    }));
    
    // Deberia mostrar exito
    expect(result.current.modalConfig.variant).toBe('success');
  });
});
