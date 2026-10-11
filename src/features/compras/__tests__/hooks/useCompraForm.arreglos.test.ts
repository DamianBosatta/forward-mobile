import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCompraForm } from '../../hooks/useCompraForm'
import { api, useInfiniteProductos } from '@/libs/api-client'
import {
  useCompra,
  useCreateCompra,
  useUpdateCompra,
  useConfirmarCompra,
  useRecibirCompra,
} from '../../api/queries'

// Arreglos de compras (PR 0.5): costo inventado, tope de 150 productos y errores tragados.

const PROV = { id: '11111111-1111-4111-8111-111111111111', razonSocial: 'Proveedor Uno' }
const DEP = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Central' }
const PROD_ID = '33333333-3333-4333-8333-333333333333'
const COMPRA_ID = '44444444-4444-4444-8444-444444444444'
const PROVEEDORES = { items: [PROV] }
const DEPOSITOS = [DEP]
const PAGINA = { pages: [{ items: [{ id: PROD_ID, nombre: 'Jabón', precioVenta: 1000 }], hasNextPage: false }] }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/libs/api-client', () => ({
  api: { get: jest.fn() },
  useProductos: jest.fn(),
  useInfiniteProductos: jest.fn(),
  useProveedores: jest.fn(),
  useDepositos: jest.fn(),
}))

jest.mock('../../api/queries', () => ({
  useCompra: jest.fn(),
  useCreateCompra: jest.fn(),
  useUpdateCompra: jest.fn(),
  useConfirmarCompra: jest.fn(),
  useRecibirCompra: jest.fn(),
  comprasKeys: { all: ['compras'], detail: (id: string) => ['compras', 'detail', id] },
}))

const libs = jest.requireMock('@/libs/api-client')

const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockConfirmar = jest.fn()
const mockRecibir = jest.fn()

function errorDelServidor(message: string, errors?: string[]) {
  return Object.assign(new Error(message), { name: 'ApiError', status: 400, errors })
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client }, children)
}

function render(editId?: string) {
  return renderHook(() => useCompraForm(editId), { wrapper })
}

async function conProducto(precioCompraBase: number | null) {
  ;(api.get as jest.Mock).mockResolvedValue({ id: PROD_ID, precioVenta: 1000, precioCompraBase })
  const hook = render()
  act(() => {
    hook.result.current.setProveedorSelected(PROV as never)
    hook.result.current.setDepositoSelected(DEP as never)
    hook.result.current.setProductoCantidad({ id: PROD_ID, nombre: 'Jabón', precioVenta: 1000 } as never, 2)
  })
  // Deja resolver la consulta del último costo, si la hay.
  await act(async () => {})
  return hook
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  libs.useProductos.mockReturnValue({ data: { items: PAGINA.pages[0].items }, isLoading: false })
  ;(useInfiniteProductos as jest.Mock).mockReturnValue({ data: PAGINA, isLoading: false, hasNextPage: false, fetchNextPage: jest.fn() })
  libs.useProveedores.mockReturnValue({ data: PROVEEDORES })
  libs.useDepositos.mockReturnValue({ data: DEPOSITOS })
  ;(useCompra as jest.Mock).mockReturnValue({ data: undefined, isLoading: false })
  ;(useCreateCompra as jest.Mock).mockReturnValue({ mutateAsync: mockCreate, isPending: false })
  ;(useUpdateCompra as jest.Mock).mockReturnValue({ mutateAsync: mockUpdate, isPending: false })
  ;(useConfirmarCompra as jest.Mock).mockReturnValue({ mutateAsync: mockConfirmar, isPending: false })
  ;(useRecibirCompra as jest.Mock).mockReturnValue({ mutateAsync: mockRecibir, isPending: false })
})

describe('costo de la línea', () => {
  it('con precio de venta y sin costo en el servidor, la línea queda sin costo y no se puede confirmar', async () => {
    const { result } = await conProducto(null)

    await waitFor(() => expect(result.current.detalles).toHaveLength(1))
    expect(result.current.detalles[0].costoUnitario).toBeNull()
    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.updateCosto(PROD_ID, '450'))
    expect(result.current.detalles[0].costoUnitario).toBe(450)
    expect(result.current.canSubmit).toBe(true)
  })

  it('precarga el último costo que entrega el servidor', async () => {
    const { result } = await conProducto(1234)

    await waitFor(() => expect(result.current.detalles[0]?.costoUnitario).toBe(1234))
    expect(result.current.canSubmit).toBe(true)
  })
})

describe('búsqueda de productos', () => {
  it('manda el término al servidor en vez de filtrar una lista recortada', async () => {
    const { result } = render()

    act(() => result.current.setProductSearch('ABC-77'))

    await waitFor(() =>
      expect(useInfiniteProductos).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ABC-77' })),
    )
    expect(libs.useProductos).not.toHaveBeenCalled()
  })
})

describe('errores del servidor', () => {
  it('si falla crear, muestra el motivo del servidor y no muestra éxito', async () => {
    mockCreate.mockRejectedValue(
      errorDelServidor('Hay errores de validación.', ['El costo unitario debe ser mayor a 0.']),
    )
    const { result } = await conProducto(500)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(() => result.current.onSubmit())

    const mensaje = (Alert.alert as jest.Mock).mock.calls[0][1] as string
    expect(mensaje).toContain('El costo unitario debe ser mayor a 0.')
    expect(result.current.successModal).toBe(false)
  })

  it('si recibir falla después de crear y confirmar, dice qué quedó hecho y qué no', async () => {
    mockCreate.mockResolvedValue({ id: COMPRA_ID })
    mockConfirmar.mockResolvedValue(undefined)
    mockRecibir.mockRejectedValue(errorDelServidor('El depósito está inactivo.'))
    const { result } = await conProducto(500)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    act(() => result.current.setEstadoOrden('Recibida'))

    await act(() => result.current.onSubmit())

    const mensaje = (Alert.alert as jest.Mock).mock.calls[0][1] as string
    expect(mensaje).toMatch(/creada/i)
    expect(mensaje).toMatch(/confirmada/i)
    expect(mensaje).toContain('El depósito está inactivo.')
    expect(mensaje).toMatch(/no se recibió/i)
    expect(result.current.successModal).toBe(false)
  })

  it('si confirmar falla, no muestra éxito', async () => {
    mockCreate.mockResolvedValue({ id: COMPRA_ID })
    mockConfirmar.mockRejectedValue(errorDelServidor('El proveedor está bloqueado.'))
    const { result } = await conProducto(500)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    act(() => result.current.setEstadoOrden('Confirmado'))

    await act(() => result.current.onSubmit())

    const mensaje = (Alert.alert as jest.Mock).mock.calls[0][1] as string
    expect(mensaje).toContain('El proveedor está bloqueado.')
    expect(mensaje).toMatch(/creada/i)
    expect(result.current.successModal).toBe(false)
  })

  it('editar una compra confirmada solo la guarda: no la vuelve a confirmar ni se traga el error', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({
      data: {
        id: COMPRA_ID,
        proveedorId: PROV.id,
        depositoId: DEP.id,
        estado: 'Confirmado',
        detalles: [{ productoId: PROD_ID, nombreProducto: 'Jabón', costoUnitarioBaseAmount: 500, cantidad: 1 }],
      },
      isLoading: false,
    })
    mockUpdate.mockResolvedValue({})
    const { result } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(() => result.current.onSubmit())

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockConfirmar).not.toHaveBeenCalled()
    expect(mockRecibir).not.toHaveBeenCalled()
    expect(result.current.successModal).toBe(true)
  })
})

describe('edición y reintentos (JD11)', () => {
  const COMPRA = {
    id: COMPRA_ID,
    version: 7,
    proveedorId: PROV.id,
    depositoId: DEP.id,
    estado: 'Presupuesto',
    detalles: [{ productoId: PROD_ID, nombreProducto: 'Jabón', costoUnitarioBaseAmount: 500, cantidad: 1 }],
  }

  it('editar manda la versión cargada para la concurrencia optimista', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false })
    mockUpdate.mockResolvedValue({})
    const { result } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(() => result.current.onSubmit())

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: COMPRA_ID, data: expect.objectContaining({ version: 7 }) }),
    )
  })

  it('editar manda la versión capturada al cargar, no la de un refetch con el cambio de otro', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false })
    mockUpdate.mockResolvedValue({})
    const { result, rerender } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    ;(useCompra as jest.Mock).mockReturnValue({ data: { ...COMPRA, version: 9 }, isLoading: false })
    rerender({})

    await act(() => result.current.onSubmit())

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 7 }) }))
  })

  it('el costo se lee en es-AR y no se le come el separador al tipear', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false })
    const { result } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.detalles).toHaveLength(1))

    act(() => result.current.updateCosto(PROD_ID, '12.'))
    expect(result.current.detalles[0]).toMatchObject({ costoTexto: '12.', costoUnitario: 12 })
    act(() => result.current.updateCosto(PROD_ID, '1.150,50'))
    expect(result.current.detalles[0]).toMatchObject({ costoTexto: '1.150,50', costoUnitario: 1150.5 })
  })

  it('si la versión quedó vieja, muestra el mensaje del servidor y no muestra éxito', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false })
    mockUpdate.mockRejectedValue(errorDelServidor('La compra fue modificada por otro usuario.'))
    const { result } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(() => result.current.onSubmit())

    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toContain('modificada por otro usuario')
    expect(result.current.successModal).toBe(false)
  })

  it('tras una falla parcial no se vuelve a crear la compra', async () => {
    mockCreate.mockResolvedValue({ id: COMPRA_ID })
    mockConfirmar.mockRejectedValue(errorDelServidor('El proveedor está bloqueado.'))
    const { result } = await conProducto(500)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    act(() => result.current.setEstadoOrden('Confirmado'))

    await act(() => result.current.onSubmit())
    expect(result.current.canSubmit).toBe(false)
    await act(() => result.current.onSubmit())

    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('si el servidor no devuelve el id, lo dice y no confirma /compras/undefined', async () => {
    mockCreate.mockResolvedValue({})
    const { result } = await conProducto(500)
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    act(() => result.current.setEstadoOrden('Confirmado'))

    await act(() => result.current.onSubmit())

    expect(mockConfirmar).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(result.current.successModal).toBe(false)
  })

  it('un refetch de proveedores no pisa el costo que el usuario está editando', async () => {
    ;(useCompra as jest.Mock).mockReturnValue({ data: COMPRA, isLoading: false })
    libs.useProveedores.mockImplementation(() => ({ data: { items: [PROV] } }))
    libs.useDepositos.mockImplementation(() => ({ data: [DEP] }))
    const { result, rerender } = render(COMPRA_ID)
    await waitFor(() => expect(result.current.detalles).toHaveLength(1))

    act(() => result.current.updateCosto(PROD_ID, '900'))
    rerender({})
    rerender({})

    expect(result.current.detalles[0].costoUnitario).toBe(900)
  })
})

