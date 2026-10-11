import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { DetalleAutorizacion } from '../components/DetalleAutorizacion'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const VENTA = {
  venta: {
    id: 'v1', codigoPedido: 'A00428', estado: 9, version: 42, clienteNombre: 'Gral. Paz 10450 - Limpieza Total', vendedorNombre: 'Lucía Ferreyra',
    totalAmount: 336076.11, subtotalBrutoAmount: 331788.96, montoDescuentoAmount: 0, cargoFleteAmount: 4287.15,
    motivoPendienteAutorizacion: 2 | 1, motivoVentaSinStock: 'Entra el martes', gananciaBrutaAmount: null, margenBrutoPorcentaje: null,
  },
  detalles: [{ id: 'd1', productoNombre: 'Detergente Magistral', cantidad: 24, precioUnitario: 2323.2, subtotal: 55756.8, porcentajeDescuentoItem: 12 }],
}
const PREVIEW = {
  ventaId: 'v1', totalSacrificio: 0, valorStockLiberado: 0,
  items: [{ detalleId: 'd1', productoId: 'p1', productoNombre: 'Detergente Magistral', cantidad: 24, precioEfectivo: 2323.2, precioMinimoRentable: 2420, aporteOverhead: null, sacrificio: 96.8 }],
}

function permisos(...modulos: string[]) {
  useAuthStore.setState({ user: { id: 'u1', username: 'marina', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) } } as never)
}

function pintar(venta: object = VENTA) {
  mockGet.mockImplementation((url: string) => Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : venta))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue(true)
})

describe('Autorizar venta: el detalle', () => {
  it('muestra todos los motivos y el del vendedor, las líneas y los totales', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar()
    expect(await screen.findByText('Autorizar A00428')).toBeTruthy()
    expect(screen.getByText(/margen en amarillo/)).toBeTruthy()
    expect(screen.getByText(/Falta stock/)).toBeTruthy()
    expect(screen.getByText('Motivo del vendedor: «Entra el martes»')).toBeTruthy()
    expect(screen.getByText('24 × $ 2.323,20 · Desc. 12,0 %')).toBeTruthy()
    expect(screen.getByLabelText('Flete: $ 4.287,15')).toBeTruthy()
  })

  it('sin CAP_VER_COSTOS no hay costos ni se pide la vista previa', async () => {
    permisos('MOD_VENTAS', 'MOD_REPORTES', 'CAP_AUTORIZAR_VENTA')
    pintar()
    await screen.findByText('Autorizar A00428')
    expect(screen.queryByTestId('bloque-costos')).toBeNull()
    expect(screen.queryByText(/Ganancia bruta|Aporte|Sacrificio/)).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('autorizacion-preview'))).toBe(false)
  })

  it('con CAP_VER_COSTOS, lo que el servidor manda en null se ve "—", nunca "$ 0"', async () => {
    permisos('MOD_VENTAS', 'MOD_REPORTES', 'CAP_AUTORIZAR_VENTA', 'CAP_VER_COSTOS')
    pintar()
    const bloque = await screen.findByTestId('bloque-costos')
    expect(await within(bloque).findByText('Aporte — · Sacrificio $ 96,80')).toBeTruthy()
    expect(within(bloque).getAllByText('—')).toHaveLength(2) // ganancia y margen de la venta
    expect(within(bloque).queryByText(/\$ 0,00/)).toBeNull()
  })

  it('con CAP_VER_COSTOS pero sin Reportes no pide la vista previa (el servidor daría 403)', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA', 'CAP_VER_COSTOS')
    pintar()
    await screen.findByTestId('bloque-costos')
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('autorizacion-preview'))).toBe(false)
  })

  it('con margen en amarillo autorizar exige la razón y la manda con la versión del detalle', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBe(true)

    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'Cliente estratégico')
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 42, razon: 'Cliente estratégico' })
    expect(mockBack).toHaveBeenCalled()
  })

  it('si la venta ya no espera autorización, no ofrece decidir', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar({ ...VENTA, venta: { ...VENTA.venta, estado: 2 } })
    expect(await screen.findByText('Esta venta ya no espera autorización.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autorizar' })).toBeNull()
  })

  it('sin CAP_AUTORIZAR_VENTA (entrando por un enlace) el detalle es de solo lectura', async () => {
    permisos('MOD_VENTAS')
    pintar()
    expect(await screen.findByText(/necesitás el permiso de autorizar ventas/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autorizar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull()
  })

  it('al abrir la decisión vuelve a pedir la venta y manda la versión nueva, no la cacheada', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    let pedidos = 0
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : { ...VENTA, venta: { ...VENTA.venta, version: 42 + pedidos++ } }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 43, razon: 'ok' })
  })

  it('tras un 409 vuelve a pedir la venta y el reintento manda la versión nueva', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    let version = 42
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : { ...VENTA, venta: { ...VENTA.venta, version } }))
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Conflicto: el dato fue modificado por otro usuario.'), { status: 409 }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    version = 44 // otro usuario editó la venta
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(await screen.findByText(/modificado por otro usuario/)).toBeTruthy()

    await waitFor(() => expect(mockGet.mock.calls.filter(([u]) => u === '/api/v1/Ventas/v1').length).toBeGreaterThanOrEqual(3))
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 44, razon: 'ok' })
  })
})
