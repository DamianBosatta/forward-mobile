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
      result.current.setMargen('20'); // Markup 20%
    });

    // Markup sobre el costo: 100 * 1.2 = 120
    expect(result.current.precioVentaSugerido).toBe(120);
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
      markupPorcentaje: 20
    }));
    
    // Deberia mostrar exito
    expect(result.current.modalConfig.variant).toBe('success');
  });

  it('en edicion carga el markup del servidor y lo manda tal cual al guardar', async () => {
    const { useProducto } = require('../../api/queries');
    (useProducto as jest.Mock).mockReturnValueOnce({
      data: { id: 'p1', nombre: 'Jabon', precioCompraBase: 100, markupPorcentaje: 130 },
      isLoading: false,
    });
    mockMutateAsyncUpdate.mockResolvedValueOnce({});
    const { result } = renderHook(() => useProductoForm('p1'));

    expect(result.current.margen).toBe('130');

    await act(async () => {
      await result.current.handleSubmit();
    });

    const body = mockMutateAsyncUpdate.mock.calls[0][0];
    expect(body.markupPorcentaje).toBe(130);
    expect(body).not.toHaveProperty('margenGanancia');
  });
});
