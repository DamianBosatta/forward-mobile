import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) },
  API_URL: 'x',
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }))
let mockPermisos = ['update', 'delete']
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (_m: string, a: string) => mockPermisos.includes(a) }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const compra = (o: Record<string, unknown> = {}) => ({
  id: 'aaaa1111-0000', version: 3, proveedorId: 'p1', razonSocialProveedor: 'Insumos del Sur SA', depositoId: 'd', nombreDeposito: 'Depósito Central',
  fecha: '2026-10-08T01:30:00Z', estado: 'NotaPedido', subtotalBrutoAmount: 55200, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 55200,
  condicionPago: { tipo: 'Contado', descripcion: 'Contado' }, conFactura: false, eliminada: false,
  detalles: [{ id: 'l1', productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 1150, costoUnitarioNetoAmount: 1150, descuentoPorcentaje: 0, subtotalAmount: 55200 }],
  ...o,
})

function abrir(datos: Record<string, unknown>) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  mockGet.mockResolvedValue(compra(datos))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraDetalle id="aaaa1111-0000" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPermisos = ['update', 'delete']
  mockPost.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
})

describe('detalle de compra', () => {
  it('nota de pedido: muestra líneas y total, y confirma; si el servidor rechaza, el motivo queda a la vista', async () => {
    abrir({})
    expect(await screen.findByText('Balde Nuvia 10L')).toBeTruthy()
    expect(screen.getByText('Pendiente')).toBeTruthy()
    // 01:30 UTC del 8 es el 7 en Argentina: el día es el del servidor, no el del teléfono.
    expect(screen.getByText('AAAA1111 · 07/10/2026')).toBeTruthy()
    expect(screen.getByLabelText('Total: $ 55.200,00')).toBeTruthy()
    mockPost.mockRejectedValueOnce(Object.assign(new Error('No se le puede comprar a Insumos del Sur SA'), { status: 400 }))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/confirmar', {})
    expect(await screen.findByText(/No se confirmó la compra: No se le puede comprar/)).toBeTruthy()
  })

  it('confirmada con condición por días desde la factura: recibir pide la fecha de la factura', async () => {
    abrir({ estado: 'Confirmado', condicionPago: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } })
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
    const fecha = screen.getByLabelText('Fecha de la factura')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '31/02/2026')
    expect(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)).toBeDisabled()
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '05/10/2026')
    await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', { compraId: 'aaaa1111-0000', fechaFacturaProveedor: '2026-10-05' })
  })

  it('confirmada al contado: recibir no pide fecha de factura', async () => {
    abrir({ estado: 'Confirmado' })
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
    expect(screen.queryByLabelText('Fecha de la factura')).toBeNull()
    await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', { compraId: 'aaaa1111-0000', fechaFacturaProveedor: null })
  })

  it('cancelar exige un motivo y lo manda al servidor', async () => {
    abrir({})
    await userEvent.press(await screen.findByRole('button', { name: 'Cancelar compra' }))
    const boton = () => screen.getAllByRole('button', { name: 'Cancelar compra' }).at(-1)!
    expect(boton()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Motivo'), 'El proveedor no tiene stock')
    await userEvent.press(boton())
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/anular', { motivoAnulacion: 'El proveedor no tiene stock' }))
  })

  it('editar abre el formulario de la compra', async () => {
    abrir({})
    await userEvent.press(await screen.findByRole('button', { name: 'Editar la compra' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/nueva?edit=aaaa1111-0000')
  })

  it('una compra recibida no se edita, no se confirma ni se cancela', async () => {
    abrir({ estado: 'Entregado', fechaVencimientoPago: '2026-11-07' })
    expect(await screen.findByText('Recibido')).toBeTruthy()
    expect(screen.getByText('Vence el 07/11/2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirmar compra|Recibir|Cancelar compra|Editar la compra/ })).toBeNull()
  })

  it('sin permiso de modificar no hay confirmar ni editar', async () => {
    mockPermisos = []
    abrir({})
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar la compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar compra' })).toBeNull()
  })
})
