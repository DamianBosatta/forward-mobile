import React from 'react'
import { render, screen, userEvent, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'
import { useAuthStore } from '@/features/auth/store/auth.store'

jest.setTimeout(15000)

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: jest.fn(), delete: jest.fn(), postConSobre: jest.fn() },
  API_URL: 'x',
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }))
let mockPermisos = ['update', 'delete']
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (_m: string, a: string) => mockPermisos.includes(a) }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const linea = (id: string, nombre: string, cantidad: number, extra: Record<string, unknown> = {}) => ({
  id, productoId: `p-${id}`, nombreProducto: nombre, cantidad, cantidadIngresada: cantidad, unidadCompra: 'Unidad',
  costoUnitarioBaseAmount: 100, costoUnitarioNetoAmount: 100, descuentoPorcentaje: 0, subtotalAmount: cantidad * 100, ...extra,
})
const compra = (o: Record<string, unknown> = {}) => ({
  id: 'aaaa1111-0000', version: 3, numero: 1784, proveedorId: 'p1', razonSocialProveedor: 'Jofer Joan', depositoId: 'd', nombreDeposito: 'Depósito Central',
  fecha: '2026-10-17T15:00:00Z', estado: 'Confirmado', subtotalBrutoAmount: 7600, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 7600,
  condicionPago: { tipo: 'Contado', descripcion: 'Contado al recibir' }, conFactura: false, eliminada: false,
  detalles: [linea('l1', 'Balde Nuvia 10L', 24, { cantidadIngresada: 2, unidadCompra: 'Bulto' }), linea('l2', 'Ocean Toalla Rollo', 40), linea('l3', 'Make Lavajean', 12)],
  ...o,
})

function abrir(datos: Record<string, unknown> = {}, ancho = 390) {
  mockDims.mockReturnValue({ width: ancho, height: 800, scale: 2, fontScale: 1 })
  mockGet.mockResolvedValue(compra(datos))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraDetalle id="aaaa1111-0000" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPermisos = ['update', 'delete']
  mockPost.mockResolvedValue(undefined)
  useAuthStore.setState({ user: null })
})

describe('detalle de compra (R8)', () => {
  it('muestra el camino de la compra con el paso actual marcado', async () => {
    abrir()
    const camino = await screen.findByLabelText('Estado de la compra')
    expect(camino).toBeTruthy()
    expect(screen.getByText('Nota de pedido')).toBeTruthy()
    expect(screen.getByLabelText('Confirmada, paso actual')).toBeTruthy()
    expect(screen.getByLabelText('Recibida, pendiente')).toBeTruthy()
  })

  it('confirmada: avisa que ya cuenta como stock por ingresar y ofrece Recibir mercadería', async () => {
    abrir()
    expect(await screen.findByText('Ya cuenta como stock por ingresar. Cuando llegue, marcala recibida.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recibir mercadería' })).toBeTruthy()
  })

  it('una compra eliminada es historial: sin ningún botón de operar', async () => {
    abrir({ eliminada: true })
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByRole('button', { name: /Recibir mercadería|Cancelar compra|Editar la compra|Confirmar compra/ })).toBeNull()
  })

  it('una nota de pedido sin líneas no ofrece confirmar', async () => {
    abrir({ estado: 'NotaPedido', detalles: [] })
    await screen.findByLabelText('Estado de la compra')
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar y recibir' })).toBeNull()
  })

  it('cancelar dice qué pasa según el estado (texto de la web)', async () => {
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Cancelar compra' }))
    expect(screen.getByText(/Se libera el stock virtual que esta compra tenía reservado/)).toBeTruthy()
  })

  it('anular la recepción dice las consecuencias de la web', async () => {
    useAuthStore.setState({ user: { permissions: [{ module: 'CAP_ANULAR_RECEPCION_COMPRAS', canRead: true }] } as never })
    abrir({ estado: 'Entregado' })
    await userEvent.press(await screen.findByRole('button', { name: 'Anular recepción' }))
    expect(screen.getByText(/Si parte de la mercadería ya se vendió o está reservada, o si la compra tiene pagos imputados, no se puede anular\./)).toBeTruthy()
  })
})

describe('recibir mercadería (M11)', () => {
  const abrirRecepcion = async (datos: Record<string, unknown> = {}, ancho = 390) => {
    abrir(datos, ancho)
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir mercadería' }))
  }

  it('pantalla propia: qué se pidió por línea y cuánto suma al stock', async () => {
    await abrirRecepcion()
    expect(screen.getByText('Compra C-01784 · Jofer Joan')).toBeTruthy()
    expect(screen.getByText('Pedidas 24 · 2 bultos')).toBeTruthy()
    expect(screen.getByText('Pedidas 40')).toBeTruthy()
    expect(screen.getByText('Suma 76 unidades al stock y genera la deuda con el proveedor')).toBeTruthy()
  })

  it('confirmar recepción manda lo mismo que antes: solo el id, la fecha de factura y el comprobante', async () => {
    await abrirRecepcion()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', { compraId: 'aaaa1111-0000', fechaFacturaProveedor: null })
  })

  it('con la condición por días desde la factura exige la fecha, y la rechaza fuera del rango de la web', async () => {
    await abrirRecepcion({ condicionPago: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } })
    const fecha = screen.getByLabelText('Fecha de la factura')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '05/10/2015')
    expect(screen.getByText('La fecha de factura no puede ser posterior a mañana ni tener más de un año.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeDisabled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('con días desde la factura muestra el vencimiento estimado', async () => {
    await abrirRecepcion({ condicionPago: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } })
    fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
    expect(screen.getByText('Vence el 04/11/2026')).toBeTruthy()
  })

  it('un rechazo del servidor queda a la vista y no cierra la pantalla', async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error('La compra ya no está confirmada'), { status: 409 }))
    await abrirRecepcion()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
    expect(await screen.findByText(/No se recibió la compra: La compra ya no está confirmada/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeTruthy()
  })

  it('mientras se manda la recepción no se puede volver: no hay forma de mandarla dos veces', async () => {
    mockPost.mockReturnValueOnce(new Promise(() => {}))
    await abrirRecepcion()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
    await userEvent.press(screen.getByLabelText('Volver'))

    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recibir mercadería' })).toBeNull()
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('volver sin confirmar no recibe nada', async () => {
    await abrirRecepcion()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Recibir mercadería' })).toBeTruthy()
  })

  it('cada línea trae cuánto llegó, de entrada lo pedido; si llegó todo es la recepción de siempre', async () => {
    await abrirRecepcion()
    expect(screen.getByLabelText('Llegó de Balde Nuvia 10L').props.value).toBe('24')
    expect(screen.getByLabelText('Llegó de Ocean Toalla Rollo').props.value).toBe('40')
    expect(screen.queryByText(/pasa a una compra nueva/)).toBeNull()
  })

  it('llegó una parte: dice qué pasa a la compra nueva y manda lo que llegó a recibir-parcial', async () => {
    await abrirRecepcion()
    fireEvent.changeText(screen.getByLabelText('Llegó de Ocean Toalla Rollo'), '30')
    fireEvent.changeText(screen.getByLabelText('Llegó de Make Lavajean'), '0')

    expect(screen.getByText('Lo que falta pasa a una compra nueva del mismo proveedor, confirmada y con los mismos costos: 10 de Ocean Toalla Rollo, 12 de Make Lavajean.')).toBeTruthy()
    expect(screen.getByText('Suma 54 unidades al stock y genera la deuda con el proveedor')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir-parcial', {
      fechaFacturaProveedor: null,
      lineas: [
        { detalleId: 'l1', cantidadRecibida: 24 },
        { detalleId: 'l2', cantidadRecibida: 30 },
        { detalleId: 'l3', cantidadRecibida: 0 },
      ],
    })
  })

  it('más de lo pedido en una línea: lo marca y no deja confirmar', async () => {
    await abrirRecepcion()
    fireEvent.changeText(screen.getByLabelText('Llegó de Ocean Toalla Rollo'), '41')
    expect(screen.getByText('No puede llegar más de lo pedido.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeDisabled()
  })

  it('no llegó nada: lo dice y no deja confirmar', async () => {
    await abrirRecepcion()
    for (const nombre of ['Balde Nuvia 10L', 'Ocean Toalla Rollo', 'Make Lavajean']) fireEvent.changeText(screen.getByLabelText(`Llegó de ${nombre}`), '0')
    expect(screen.getByText('No llegó nada: para recibir tiene que haber llegado al menos una línea.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeDisabled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('tablet: la misma recepción, con las líneas en tabla (Producto, Pedidas, Costo, Subtotal)', async () => {
    await abrirRecepcion({}, 1194)
    expect(screen.getByText('Subtotal')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeTruthy()
  })
})
