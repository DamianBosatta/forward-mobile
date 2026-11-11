import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraGuardadaPantalla } from '../../components/CompraGuardadaPantalla'
import type { Aviso } from '../../lib/confirmar-y-recibir'

jest.setTimeout(15000)

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPostConSobre = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: jest.fn(), delete: jest.fn(), postConSobre: (...a: unknown[]) => mockPostConSobre(...a) },
  API_URL: 'x',
}))
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }) }))
let mockPuedeModificar = true
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (_m: string, a: string) => (a === 'update' ? mockPuedeModificar : a === 'read') }) }))

const ESPERA = { timeout: 3000 }
const linea = (id: string, nombre: string, cantidad: number) => ({
  id, productoId: `p-${id}`, nombreProducto: nombre, cantidad, cantidadIngresada: cantidad, unidadCompra: 'Unidad',
  costoUnitarioBaseAmount: 100, costoUnitarioNetoAmount: 100, descuentoPorcentaje: 0, subtotalAmount: cantidad * 100,
})
let estado = 'Confirmado'
const compra = () => ({
  id: 'c1', version: 3, numero: 232, proveedorId: 'p1', razonSocialProveedor: 'Distribuidora Ejemplo Norte SRL', depositoId: 'd', nombreDeposito: 'Depósito central',
  fecha: '2026-11-11T15:00:00Z', estado, subtotalBrutoAmount: 25600, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 25600,
  condicionPago: { tipo: 'Contado', descripcion: 'Contado' }, conFactura: false, eliminada: false,
  detalles: [linea('l1', 'Aceite girasol 900 ml', 240), linea('l2', 'Galletitas dulces pack x8', 16)],
})

function abrir(aviso?: Aviso) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraGuardadaPantalla id="c1" aviso={aviso} /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  estado = 'Confirmado'
  mockPuedeModificar = true
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/v1/Compras/c1') return Promise.resolve(compra())
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve({ id: 'p1', razonSocial: 'Distribuidora Ejemplo Norte SRL', cuit: '30-12345678-9' })
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
  mockPost.mockResolvedValue(undefined)
})

describe('Compra guardada (frames 17 a 20)', () => {
  it('confirmada: título, proveedor, resumen, estado "Por recibir" y qué falta para que entre el stock', async () => {
    abrir()
    expect(await screen.findByText('Compra C-00232 confirmada', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Distribuidora Ejemplo Norte SRL')).toBeTruthy()
    expect(await screen.findByText('CUIT 30-12345678-9', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('2 productos · 256 unidades')).toBeTruthy()
    expect(screen.getByLabelText('Estado: Por recibir')).toBeTruthy()
    expect(screen.getByText('Depósito central')).toBeTruthy()
    expect(screen.getByText('Quedó guardado.')).toBeTruthy()
    expect(screen.getByText('Todavía no entró stock ni se generó la deuda con el proveedor: se hace al recibir la mercadería.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recibir mercadería' })).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Ver la compra' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/c1')
  })

  it('"Comprarle a otro proveedor", "Volver a Compras" y "Listo" salen de la pantalla', async () => {
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Comprarle a otro proveedor' }, ESPERA))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/nueva')
    await userEvent.press(screen.getByRole('button', { name: 'Volver a Compras' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras')
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })

  it('confirmada y recibida: el aviso del servidor y lo que suma al stock; no ofrece recibir', async () => {
    estado = 'Entregado'
    abrir({ clave: 'recibida', texto: 'Compra confirmada. Compra recibida.', tono: 'exito' })
    expect(await screen.findByText('Compra C-00232 recibida', {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText('Estado: Recibido')).toBeTruthy()
    expect(screen.getByText('Compra confirmada. Compra recibida.')).toBeTruthy()
    expect(screen.getByText('Suma 256 unidades al stock y genera la deuda con el proveedor')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recibir mercadería' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cargar el comprobante del proveedor' })).toBeTruthy()
  })

  it('por recibir: "Recibir mercadería" abre la recepción y, si llegó una parte, queda "Recibida con faltante" con la compra nueva', async () => {
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir mercadería' }, ESPERA))
    expect(await screen.findByText('Cuánto llegó de cada línea')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Llegó de Aceite girasol 900 ml'), '120')
    mockPostConSobre.mockResolvedValue({ data: 'c1', sobre: { succeeded: true, compraFaltanteId: 'c2', compraFaltanteNumero: 233 } })
    estado = 'Entregado'
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
    expect(await screen.findByLabelText('Estado: Recibida con faltante', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Lo que faltó pasó a la compra C-00233, confirmada y pendiente de recibir.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Ver la compra C-00233' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/c2')
  })

  it('nota de pedido: no se recibe; "Confirmar compra" la confirma y pasa a "confirmada"', async () => {
    estado = 'NotaPedido'
    abrir()
    expect(await screen.findByText('Nota de pedido C-00232 guardada', {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText('Estado: Nota de pedido')).toBeTruthy()
    expect(screen.getByText('Todavía no es una compra: no ingresa stock ni genera deuda hasta que la confirmes.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recibir mercadería' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Ver la nota de pedido' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/c1')
    estado = 'Confirmado'
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', {}), ESPERA)
    expect(await screen.findByText('Compra C-00232 confirmada', {}, ESPERA)).toBeTruthy()
  })

  it('un rechazo al confirmar la nota de pedido queda a la vista', async () => {
    estado = 'NotaPedido'
    mockPost.mockRejectedValue(Object.assign(new Error('Faltan costos.'), { status: 400 }))
    abrir()
    await userEvent.press(await screen.findByRole('button', { name: 'Confirmar compra' }, ESPERA))
    expect(await screen.findByText(/No se confirmó la compra: Faltan costos\./, {}, ESPERA)).toBeTruthy()
  })

  it('sin permiso de modificar no se recibe ni se confirma desde acá', async () => {
    mockPuedeModificar = false
    abrir()
    await screen.findByText('Compra C-00232 confirmada', {}, ESPERA)
    expect(screen.queryByRole('button', { name: 'Recibir mercadería' })).toBeNull()
  })

  it('si no se puede traer la compra lo dice: ya quedó guardada', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    abrir()
    expect(await screen.findByText('No se pudo traer la compra. Ya quedó guardada: la ves en la lista.', {}, ESPERA)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras')
  })
})
