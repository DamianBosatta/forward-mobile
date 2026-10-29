import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { VentaNuevaPantalla, type AbrirVenta } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.setTimeout(20000)

const URL_DEFECTO = '/api/v1/Ventas/con-factura-por-defecto'
const URL_FISCAL = '/api/v1/Ventas/stock-fiscal/verificar'
const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const pala = producto({ real: 100, disponible: 100 })
const cabecera = (o: Record<string, unknown> = {}) => ({
  id: 'v9', codigoPedido: 'A00419', clienteId: 'c7', version: 4, estado: 2, tipoOperacion: 2, porcentajeDescuento: 0,
  metodoEntregaNombre: 'LogisticaPropia', metodoEntrega: 1, fechaEntrega: '2026-01-02T00:00:00', cargoFleteAmount: 0, observaciones: null, ...o,
})
const detalles = [{ id: 'i1', productoId: 'p1', productoNombre: 'Pala', cantidad: 12, porcentajeDescuentoItem: 0, stockDisponible: 100 }]
const socio = { id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }
let ventaServidor: unknown
let faltantes: unknown

const abrir = (a: AbrirVenta) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <VentaNuevaPantalla abrir={a} />
  </QueryClientProvider>,
)
async function editarYAbrirConfirmar() {
  abrir({ modo: 'editar', ventaId: 'v9' })
  await userEvent.press(await screen.findByRole('button', { name: 'Seguir' }))
}

beforeEach(() => {
  ventaServidor = { venta: cabecera({ conFactura: true }), detalles, bultos: [] }
  faltantes = []
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: true, canUpdate: true }], maxDescuentoPorcentaje: 10 } as never })
  useCarritoVenta.setState({ lineas: [] })
  mockPost.mockReset().mockImplementation((url: string) => Promise.resolve(
    url === URL_FISCAL ? faltantes : url === '/api/v1/Ventas/borradores' ? { ventaId: 'b1', version: 1, message: '' } : { ventaId: 'v9', version: 5, message: 'ok' }))
  mockPut.mockReset().mockImplementation((_u: string, b: { version: number }) => Promise.resolve({ ventaId: 'v9', version: b.version + 1, message: 'Venta actualizada.' }))
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/api/v1/Ventas/v9') return Promise.resolve(ventaServidor)
    if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
    if (url === URL_DEFECTO) return Promise.resolve({ ventaConFacturaPorDefecto: false })
    if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
    if (url.includes('dias-entrega')) return Promise.resolve(TODOS)
    if (url.includes('feriados')) return Promise.resolve([])
    return Promise.resolve(undefined)
  })
})

// Igual que la web (venta-form.tsx:275, 410, 846; venta-edit-helpers.ts:175, 314): al editar, el tilde sale de la venta
// (`conFactura ?? false`), no se pide el default y el PUT lo manda.
describe('T4d Con factura al editar', () => {
  it('muestra el tilde de la venta, no pide el default y el PUT manda conFactura con el resto del cuerpo igual', async () => {
    await editarYAbrirConfirmar()
    expect(await screen.findByRole('switch', { name: 'Con factura' })).toBeChecked()
    expect(screen.getByText('La deuda va a la cuenta Normal del cliente.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][1]).toEqual({
      id: 'v9', version: 4, descuentoGeneral: 0, metodoEntrega: 1, fechaEntrega: '2026-01-02', cargoFlete: 0,
      items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 0 }], conFactura: true,
    })
    expect(mockGet).not.toHaveBeenCalledWith(URL_DEFECTO)
  })

  it('si el vendedor lo cambia, el PUT manda lo elegido', async () => {
    ventaServidor = { venta: cabecera({ conFactura: false }), detalles, bultos: [] }
    await editarYAbrirConfirmar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).not.toBeChecked())
    expect(screen.getByText('La deuda va a la cuenta TST del cliente.')).toBeTruthy()
    await userEvent.press(screen.getByRole('switch', { name: 'Con factura' }))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][1]).toMatchObject({ conFactura: true })
  })

  it('una venta sin el campo se toma como false, igual que la web, y no se pide el default', async () => {
    ventaServidor = { venta: cabecera(), detalles, bultos: [] }
    await editarYAbrirConfirmar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).not.toBeChecked())
    expect(screen.getByRole('switch', { name: 'Con factura' })).toBeEnabled()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][1].conFactura).toBe(false)
    expect(mockGet).not.toHaveBeenCalledWith(URL_DEFECTO)
  })

  it('duplicar no copia el tilde de la venta: nace con el default', async () => {
    ventaServidor = { venta: cabecera({ conFactura: true }), detalles, bultos: [] }
    abrir({ modo: 'duplicar', ventaId: 'v9' })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(URL_DEFECTO))
    await userEvent.press(await screen.findByRole('button', { name: 'Seguir' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).not.toBeChecked())
  })
})

// Igual que la web (ConFacturaField.tsx:33, 51-63): POST /Ventas/stock-fiscal/verificar con los renglones, solo con el tilde
// puesto; el aviso nunca bloquea (K12).
describe('T4d aviso de stock fiscal', () => {
  it('con factura y faltante: lo muestra con el texto de la web y confirmar sigue habilitado', async () => {
    faltantes = [{ productoId: 'p1', nombre: 'Pala', cantidad: 12, stockFiscal: 5 }, { productoId: 'p2', nombre: 'Balde', cantidad: null, stockFiscal: null }]
    await editarYAbrirConfirmar()
    expect(await screen.findByText(/El stock fiscal no alcanza:/)).toBeTruthy()
    expect(screen.getByText(/Pala: pide 12, hay 5 en stock fiscal/)).toBeTruthy()
    expect(screen.getByText(/Balde: no alcanza el stock fiscal/)).toBeTruthy()
    expect(screen.getByText(/Podés confirmar igual: el stock fiscal queda negativo y sale la alerta\./)).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith(URL_FISCAL, { items: [{ productoId: 'p1', cantidad: 12 }] })
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('sin factura no consulta ni avisa', async () => {
    ventaServidor = { venta: cabecera({ conFactura: false }), detalles, bultos: [] }
    faltantes = [{ productoId: 'p1', nombre: 'Pala', cantidad: 12, stockFiscal: 5 }]
    await editarYAbrirConfirmar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).not.toBeChecked())
    expect(mockPost).not.toHaveBeenCalledWith(URL_FISCAL, expect.anything())
    expect(screen.queryByText(/El stock fiscal no alcanza:/)).toBeNull()
  })

  it('sin faltantes no muestra el aviso', async () => {
    await editarYAbrirConfirmar()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(URL_FISCAL, expect.anything()))
    expect(screen.queryByText(/El stock fiscal no alcanza:/)).toBeNull()
  })
})
