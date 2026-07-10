import { renderHook, act } from '@testing-library/react-native'
import { useCompraForm } from '../../hooks/useCompraForm'
import { useProductos, useProveedores, useDepositos } from '@/libs/api-client'
import { useCreateCompra, useUpdateCompra } from '../../api/queries'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() })
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ removeQueries: jest.fn() })
}))

jest.mock('@/libs/api-client', () => ({
  useProductos: jest.fn(),
  useProveedores: jest.fn(),
  useDepositos: jest.fn()
}))

jest.mock('../../api/queries', () => ({
  useCompra: jest.fn().mockReturnValue({ data: null, isLoading: false }),
  useCreateCompra: jest.fn(),
  useUpdateCompra: jest.fn(),
  useConfirmarCompra: jest.fn().mockReturnValue({ mutateAsync: jest.fn() }),
  useRecibirCompra: jest.fn().mockReturnValue({ mutateAsync: jest.fn() }),
  comprasKeys: { detail: jest.fn() }
}))



describe('useCompraForm', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
    ;(useProductos as jest.Mock).mockReturnValue({ data: { items: [{ id: 'p1', nombre: 'Prod 1', precioCompraBase: 100 }] } })
    ;(useProveedores as jest.Mock).mockReturnValue({ data: { items: [{ id: 'prov1', razonSocial: 'Prov 1' }] } })
    ;(useDepositos as jest.Mock).mockReturnValue({ data: [{ id: 'dep1', nombre: 'Dep 1' }] })
    
    ;(useCreateCompra as jest.Mock).mockReturnValue({ mutateAsync: mockCreate, isPending: false })
    ;(useUpdateCompra as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false })
  })

  it('debe iniciar vacio', () => {
    const { result } = renderHook(() => useCompraForm())
    
    expect(result.current.proveedorSelected).toBeNull()
    expect(result.current.detalles.length).toBe(0)
    expect(result.current.canSubmit).toBe(false)
  })

  it('debe agregar un producto y permitir submit si todo esta ok', () => {
    const { result } = renderHook(() => useCompraForm())
    
    act(() => {
      result.current.setProveedorSelected({ id: 'prov1', razonSocial: 'Prov 1' } as any)
      result.current.setDepositoSelected({ id: 'dep1', nombre: 'Dep 1' } as any)
      result.current.setProductoCantidad({ id: 'p1', nombre: 'Prod 1', precioCompraBase: 100 } as any, 2)
    })

    expect(result.current.detalles.length).toBe(1)
    expect(result.current.detalles[0].cantidad).toBe(2)
    expect(result.current.canSubmit).toBe(true)
    expect(result.current.subtotal).toBe(200)
    expect(result.current.total).toBe(200)
  })
})
