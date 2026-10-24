import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'
import { useAuthStore } from '@/features/auth/store/auth.store'

jest.setTimeout(15000)

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a), delete: jest.fn(), postConSobre: jest.fn() },
  API_URL: 'x',
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }))
let mockPermisos = ['update', 'delete']
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (_m: string, a: string) => mockPermisos.includes(a) }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///tmp/factura.jpg' }] }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///tmp/factura.jpg' }] }),
}))

const URL_FOTO = 'https://r2.forward/comprobantes/factura.jpg'
const compra = (o: Record<string, unknown> = {}) => ({
  id: 'aaaa1111-0000', version: 3, numero: 1790, proveedorId: 'p1', razonSocialProveedor: 'Jofer Joan', depositoId: 'd', nombreDeposito: 'Depósito Central',
  fecha: '2026-10-17T15:00:00Z', estado: 'Confirmado', subtotalBrutoAmount: 100, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 100,
  condicionPago: { tipo: 'Contado', descripcion: 'Contado' }, conFactura: false, eliminada: false,
  detalles: [{ id: 'l1', productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 1, cantidadIngresada: 1, unidadCompra: 'Unidad', costoUnitarioBaseAmount: 100, costoUnitarioNetoAmount: 100, descuentoPorcentaje: 0, subtotalAmount: 100 }],
  ...o,
})

function abrir(datos: Record<string, unknown> = {}) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  mockGet.mockResolvedValue(compra(datos))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraDetalle id="aaaa1111-0000" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPermisos = ['update', 'delete']
  mockPost.mockResolvedValue({ url: URL_FOTO })
  mockPut.mockResolvedValue('aaaa1111-0000')
  useAuthStore.setState({ user: null })
})

describe('vínculo entre la compra original y la de lo que faltó (R22b)', () => {
  it('la compra nueva muestra de cuál salió y abre la original', async () => {
    abrir({ compraOrigenId: 'orig-0000', compraOrigenNumero: 1784 })
    await userEvent.press(await screen.findByRole('button', { name: 'Salió de la compra C-01784' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/orig-0000')
  })

  it('la original muestra la compra con lo que faltó y la abre', async () => {
    abrir({ compraFaltanteId: 'falt-0000', compraFaltanteNumero: 1795 })
    await userEvent.press(await screen.findByRole('button', { name: 'Lo que faltó pasó a la compra C-01795' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/falt-0000')
  })

  it('una compra común (campos en null) no muestra ningún vínculo', async () => {
    abrir({ compraOrigenId: null, compraOrigenNumero: null, compraFaltanteId: null, compraFaltanteNumero: null })
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByText(/Salió de la compra|Lo que faltó pasó/)).toBeNull()
  })
})

describe('foto de la factura del proveedor (R22b)', () => {
  it('quien ve la compra ve la foto, aunque no pueda modificarla', async () => {
    mockPermisos = []
    abrir({ fotoFacturaProveedorUrl: URL_FOTO })
    expect(await screen.findByLabelText('Foto de la factura del proveedor')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /foto de la factura|Quitar la foto/ })).toBeNull()
  })

  it('sin foto y sin permiso de modificar no hay sección de foto', async () => {
    mockPermisos = []
    abrir()
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByText('Factura del proveedor')).toBeNull()
  })

  it('con permiso: saca la foto, la sube a upload-comprobante y la adjunta con PUT foto-factura', async () => {
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Sacar foto de la factura' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/foto-factura', { fotoUrl: URL_FOTO }))
    expect(mockPost.mock.calls[0][0]).toBe('/api/v1/Media/upload-comprobante')
  })

  it('con permiso: quita la foto mandando fotoUrl null', async () => {
    abrir({ fotoFacturaProveedorUrl: URL_FOTO })
    await userEvent.press(await screen.findByRole('button', { name: 'Quitar la foto de la factura' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/foto-factura', { fotoUrl: null }))
  })

  it('si el servidor rechaza (409), el motivo queda a la vista', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('La compra está cancelada'), { status: 409 }))
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Sacar foto de la factura' }))
    expect(await screen.findByText(/No se guardó la foto: La compra está cancelada/)).toBeTruthy()
  })

  it('una compra cancelada no ofrece cambiar la foto', async () => {
    abrir({ eliminada: true, fotoFacturaProveedorUrl: URL_FOTO })
    await screen.findByLabelText('Foto de la factura del proveedor')
    expect(screen.queryByRole('button', { name: /Quitar la foto|Sacar foto/ })).toBeNull()
  })
})
