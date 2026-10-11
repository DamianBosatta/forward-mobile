import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraNueva } from '../../components/CompraNueva'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
  },
  API_URL: 'x',
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const ESPERA = { timeout: 3000 }
const COMPLETO = { id: 'p1', razonSocial: 'Insumos del Sur SA', requiereCompletar: false }
const INCOMPLETO = { id: 'p2', razonSocial: 'Gorrión Mayorista', requiereCompletar: true }

function socio(id: string) {
  return id === 'p2'
    ? { id, razonSocial: 'Gorrión Mayorista', condicionesDeCompraFaltantes: ['condición de pago', 'franja de entrega'] }
    : { id, razonSocial: 'Insumos del Sur SA', condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30, descripcion: '30 días' }, condicionesDeCompraFaltantes: [] }
}

function pantalla(props: { borradorId?: string } = {}) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CompraNueva {...props} /></QueryClientProvider>)
}

const puts = () => mockPut.mock.calls.map(([, body]) => body as { detalles: { costoUnitario: number; cantidad: number; unidadCompra: string }[] })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve({ items: [COMPLETO, INCOMPLETO], totalCount: 2 })
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve(socio(url.split('/').pop()!))
    if (url.startsWith('/api/v1/Productos?')) return Promise.resolve({ items: [{ id: 'pr1', nombre: 'Balde Nuvia 10L' }], page: 1, totalCount: 1, hasNextPage: false })
    if (url === '/api/v1/Productos/pr1') return Promise.resolve({ id: 'pr1', precioCompraBase: 1020 })
    if (url === '/api/v1/Depositos') return Promise.resolve([{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central' }])
    if (url === '/api/v1/Compras/b9') {
      return Promise.resolve({
        id: 'b9', version: 40, proveedorId: 'p1', depositoId: DEPOSITO_CENTRAL_ID, gastosOperativos: 0, subtotalBrutoAmount: 0, descuentoTotalAmount: 0,
        detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 0 }],
      })
    }
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
  mockPost.mockImplementation((url: string) => {
    if (url === '/api/v1/Compras/borradores') return Promise.resolve({ compraId: 'c1', version: 10, message: 'ok' })
    return Promise.resolve(undefined)
  })
  let v = 10
  mockPut.mockImplementation(() => Promise.resolve({ compraId: 'c1', version: ++v, message: 'ok' }))
})

async function agregarBalde(cantidad: string) {
  await userEvent.press(screen.getByRole('button', { name: '+ Agregar productos' }))
  await userEvent.type(await screen.findByPlaceholderText('0'), cantidad)
}

describe('pantalla de compra nueva', () => {
  it('a un proveedor sin condición de pago o franja no se le compra: aviso y no se crea el borrador', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: /Gorrión Mayorista/ }))
    expect(await screen.findByText(/le falta condición de pago y franja de entrega/)).toBeTruthy()
    expect(screen.getByText(/Completalo en la web para poder comprarle/)).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('una línea sin costo queda marcada y no se puede confirmar hasta cargarle el costo', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/api/v1/Compras/b9'
        ? Promise.resolve({ id: 'b9', version: 40, proveedorId: 'p1', depositoId: 'd', gastosOperativos: 0, subtotalBrutoAmount: 0, descuentoTotalAmount: 0,
            detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 0 }] })
        : url.startsWith('/api/v1/socios-comerciales/') ? Promise.resolve(socio('p1')) : Promise.resolve([]))
    pantalla({ borradorId: 'b9' })
    expect(await screen.findByText('48 × — · Falta el costo')).toBeTruthy()
    expect(screen.getByText(/Una línea no tiene costo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    // Tocar la línea abre la edición: con el costo cargado deja de estar marcada y se puede confirmar.
    await userEvent.press(screen.getByRole('button', { name: /Balde Nuvia 10L, 48 × —/ }))
    await userEvent.type(screen.getByLabelText('Costo por unidad ($)'), '1.150,50')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('48 × 1150,5 · 4 bultos de 12')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await waitFor(() => expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 4, costoUnitario: 1150.5, unidadCompra: 'Bulto' }), ESPERA)
  })

  it('confirmar guarda lo pendiente y después confirma; abre la compra', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }))
    await screen.findByText('Insumos del Sur SA · 30 días')
    await agregarBalde('3')
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled())
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', { compraId: 'c1' }), ESPERA)
    expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 3, costoUnitario: 1020 })
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1')
  })
})
