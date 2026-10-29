import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

// Con la suite completa corriendo en paralelo, cargar venta + cliente + catálogo tarda más que el default.
jest.setTimeout(20000)

const pala = producto({ precioVenta: 2600 })
const venta = {
  venta: {
    id: 'b9', clienteId: 'c7', version: 4, estado: 1, tipoOperacion: 1, porcentajeDescuento: 5, metodoEntrega: 2,
    metodoEntregaNombre: 'RetiroEnLocal', fechaEntrega: null, cargoFleteAmount: 0, observaciones: 'Portón negro',
  },
  detalles: [{ id: 'i1', productoId: 'p1', productoNombre: 'Pala vieja', cantidad: 3, precioUnitario: 2496, porcentajeDescuentoItem: 10, stockDisponible: 0 }],
  bultos: [],
}
const socio = { id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel', razonSocial: 'Abel SRL' }

function pantalla(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }), tipo: 'Pedido' | 'Presupuesto' = 'Presupuesto') {
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla abrir={{ modo: 'retomar', ventaId: 'b9', tipo }} /></QueryClientProvider>)
}

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never })
  useCarritoVenta.setState({ lineas: [] })
  mockPost.mockReset()
  mockPut.mockReset().mockImplementation((_u: string, b: { version: number }) => Promise.resolve({ ventaId: 'b9', version: b.version + 1, message: 'ok' }))
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/api/v1/Ventas/b9') return Promise.resolve(venta)
    if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
    if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
    return Promise.resolve(undefined)
  })
})

describe('retomar un borrador (PR 2.2b)', () => {
  it('abre el borrador con lo que tiene el servidor, sin crear otro ni guardar de más', async () => {
    pantalla()
    expect(await screen.findByText('Nuevo presupuesto')).toBeTruthy()
    // El cliente por la dirección; el nombre aparte.
    expect(screen.getByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    // La línea toma el precio del catálogo de hoy, con la cantidad y el descuento del borrador.
    expect(useCarritoVenta.getState().lineas).toEqual([{ productoId: 'p1', producto: pala, cantidad: 3, descuentoPct: 10 }])
    expect(screen.getByText('3 u × $ 2.600,00')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: 'Descuento a toda la venta' })).getByText('5 %')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 1000))
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Ventas/borradores', expect.anything())
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('lo que se cambia se autoguarda sobre ese borrador y con su versión', async () => {
    pantalla()
    await screen.findByText('Nuevo presupuesto')
    await userEvent.press(screen.getByRole('button', { name: 'Datos de la entrega' }))
    expect(screen.getByDisplayValue('Portón negro')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Observaciones'), ', antes de las 12')
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), { timeout: 3000 })
    expect(mockPut.mock.calls[0][0]).toBe('/api/v1/Ventas/b9')
    expect(mockPut.mock.calls[0][1]).toMatchObject({
      id: 'b9', version: 4, descuentoGeneral: 5, metodoEntrega: 2, observaciones: 'Portón negro, antes de las 12',
      items: [{ productoId: 'p1', cantidad: 3, descuentoPorcentaje: 10 }],
    })
  })

  // Un Pedido guardado con 12,82 % y tope 10: el descuento no se pierde al editar si el servidor guarda el tipo.
  describe.each([
    ['servidor nuevo (el borrador trae su tipo)', [{ id: 'b9', tipoOperacion: 'Pedido' }], 12.82],
    ['servidor viejo (sin tipo)', [{ id: 'b9' }], 10],
    ['/mios no trae el borrador', [], 10],
  ] as const)('retomar un Pedido sobre el tope con %s', (_n, mios, esperado) => {
    it(`el autoguardado manda ${esperado} %`, async () => {
      const base = mockGet.getMockImplementation()!
      mockGet.mockImplementation((url: string) => url === '/api/v1/Ventas/b9' ? Promise.resolve({ ...venta, detalles: [{ ...venta.detalles[0], porcentajeDescuentoItem: 12.82 }] })
        : url === '/api/v1/Ventas/borradores/mios' ? Promise.resolve(mios) : base(url))
      pantalla(undefined, 'Pedido')
      await screen.findByText('Nuevo pedido')
      await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Ventas/borradores/mios'))
      await userEvent.press(screen.getByRole('button', { name: 'Datos de la entrega' }))
      await userEvent.type(screen.getByLabelText('Observaciones'), ' y más')
      await waitFor(() => expect(mockPut).toHaveBeenCalled(), { timeout: 3000 })
      expect(mockPut.mock.calls.at(-1)[1].items).toEqual([{ productoId: 'p1', cantidad: 3, descuentoPorcentaje: esperado }])
    })
  })

  it('los autoguardados no vuelven a pedir la venta, y al reabrirla se trae la vigente', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const detalles = () => mockGet.mock.calls.filter(([u]) => u === '/api/v1/Ventas/b9').length
    const primera = pantalla(qc)
    await screen.findByText('Nuevo presupuesto')
    expect(detalles()).toBe(1)
    await userEvent.press(screen.getByRole('button', { name: 'Datos de la entrega' }))
    await userEvent.type(screen.getByLabelText('Observaciones'), ' uno')
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), { timeout: 3000 })
    await userEvent.type(screen.getByLabelText('Observaciones'), ' dos')
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 500))
    expect(detalles()).toBe(1)
    primera.unmount()
    pantalla(qc)
    await waitFor(() => expect(detalles()).toBe(2))
  })

  it('si el borrador ya no existe, lo dice con el mensaje del servidor', async () => {
    const { ApiError } = jest.requireActual('@/core/api/client')
    mockGet.mockImplementation((url: string) => (url === '/api/v1/Ventas/b9'
      ? Promise.reject(new ApiError(404, 'Venta no encontrada.'))
      : Promise.resolve(undefined)))
    pantalla()
    expect(await screen.findByText('Venta no encontrada.')).toBeTruthy()
  })
})

describe('retomar usa la revisión nueva (S9)', () => {
  it('abre "Revisar venta" y "Confirmar venta" guarda ese mismo presupuesto con su versión', async () => {
    mockPost.mockImplementation(() => Promise.resolve({ ventaId: 'b9', version: 5, message: 'Presupuesto guardado.' }))
    pantalla()
    expect(await screen.findByText('Revisar venta')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull()
    await userEvent.press(await screen.findByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/b9/guardar-presupuesto', { ventaId: 'b9', version: expect.any(Number) }))
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Ventas', expect.anything())
  })
})
