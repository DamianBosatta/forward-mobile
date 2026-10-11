import React from 'react'
import { Alert } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { diaArgentina } from '@/src/utils/date'
import { VentaGuardadaPantalla } from '../components/VentaGuardadaPantalla'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'https://api',
  api: {
    get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a), delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockShare = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockShare(...a) }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const { ApiError } = jest.requireActual('@/core/api/client')
jest.setTimeout(20000)

const cabecera = (o: Record<string, unknown> = {}) => ({
  id: 'v9', codigoPedido: 'A00419', clienteId: 'c7', clienteNombre: 'Abel SRL', estado: 9, tipoOperacion: 2, version: 3,
  totalAmount: 51350.13, motivoPendienteAutorizacion: 4, ...o,
})
let mockVenta = { venta: cabecera(), detalles: [{ id: 'i1', productoNombre: 'Pala c/Cabo Fija LP', cantidad: 12, subtotal: 26112 }], bultos: [] }
const socio = { id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }
const permisos = (p: Record<string, boolean>) =>
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: [{ module: 'MOD_VENTAS', canRead: true, ...p }] } as never })

function pantalla(mensaje?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaGuardadaPantalla id="v9" mensaje={mensaje} /></QueryClientProvider>)
}
/** Toca el botón de una alerta (Alert.alert está espiado). */
const tocarEnAlerta = (texto: string) => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[]
  botones.find((b) => b.text === texto)?.onPress?.()
}

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  permisos({ canUpdate: true, canDelete: true })
  mockVenta = { ...mockVenta, venta: cabecera() }
  mockGet.mockReset().mockImplementation((url: string) =>
    Promise.resolve(url === '/api/v1/Ventas/v9' ? mockVenta : url === '/api/v1/socios-comerciales/c7' ? socio : undefined))
  for (const m of [mockPost, mockPut, mockDelete, mockShare, mockReplace]) m.mockReset()
})
afterEach(() => jest.restoreAllMocks())

describe('venta guardada (PR 2.9)', () => {
  it('muestra el número, el cliente por dirección, las líneas, el total y lo que dijo el servidor; Listo vuelve a la lista', async () => {
    pantalla('Quedó por autorizar porque un descuento supera tu tope. Te avisamos cuando lo resuelvan.')
    expect(await screen.findByText('Pedido A00419')).toBeTruthy()
    expect(await screen.findByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    expect(screen.getByText('Pala c/Cabo Fija LP × 12')).toBeTruthy()
    expect(screen.getByText('$ 51.350,13')).toBeTruthy()
    expect(screen.getByText(/Quedó por autorizar porque un descuento supera tu tope/)).toBeTruthy()
    // Un pedido no se convierte.
    expect(screen.queryByRole('button', { name: 'Convertir en pedido' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/ventas')
  })

  it('compartir manda la nota del servidor al panel de compartir y avisa si falla', async () => {
    mockShare.mockResolvedValue({ ok: false, reason: 'network', message: 'No se pudo conectar al servidor.' })
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir PDF con el cliente' }))
    expect(mockShare).toHaveBeenCalledWith('https://api/api/v1/Logistica/v9/nota-entrega-pdf', 'A00419.pdf')
    expect(Alert.alert).toHaveBeenCalledWith('No se pudo compartir el PDF', 'No se pudo conectar al servidor.')
  })

  it('un presupuesto pendiente se convierte en pedido con su versión y se dice cómo quedó', async () => {
    mockVenta = { ...mockVenta, venta: cabecera({ tipoOperacion: 1, estado: 1, codigoPedido: null }) }
    mockPut.mockResolvedValue(true)
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Convertir en pedido' }))
    mockVenta = { ...mockVenta, venta: cabecera({ estado: 9, motivoPendienteAutorizacion: 16 }) }
    tocarEnAlerta('Convertir')
    await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Quedó por autorizar',
      'Porque el cliente tiene deuda de más de 30 días. Te avisamos cuando lo resuelvan.'))
    expect(mockPut).toHaveBeenCalledWith('/api/v1/Ventas/v9/convertir-a-pedido', expect.objectContaining({ version: 3 }))
  })

  it('sin permiso de modificar no ofrece convertir; sin permiso de borrar no ofrece anular', async () => {
    mockVenta = { ...mockVenta, venta: cabecera({ tipoOperacion: 1, estado: 1 }) }
    permisos({})
    pantalla()
    expect(await screen.findByRole('button', { name: 'Compartir PDF con el cliente' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Convertir en pedido' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull()
  })

  it('anular pide el motivo, lo manda con la versión y muestra el rechazo del servidor', async () => {
    mockDelete.mockRejectedValue(new ApiError(400, 'No se puede anular una venta en ruta.'))
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Anular' }))
    const anular = () => screen.getAllByRole('button', { name: 'Anular' }).at(-1)!
    expect(anular()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Motivo'), 'Lo canceló el cliente')
    await userEvent.press(anular())
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/Ventas/v9', { version: 3, motivoAnulacion: 'Lo canceló el cliente' })
    expect(await screen.findByText('No se puede anular una venta en ruta.')).toBeTruthy()
  })

  it('agendar crea un recordatorio personal en el calendario del servidor para ese cliente', async () => {
    mockPost.mockResolvedValue('e1')
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Agendar' }))
    await userEvent.press(screen.getAllByRole('button', { name: 'Agendar' }).at(-1)!)
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Calendario/eventos', {
      tipo: 'Manual', titulo: 'Pedido A00419 · Tarantino 1898 · Autoservicio Abel', fechaInicio: diaArgentina(Date.now() + 86_400_000),
      socioComercialId: 'c7', avisarDiasAntes: 0, visibilidad: 'Personal',
    })
    expect(Alert.alert).toHaveBeenCalledWith('Agendado', 'Quedó en tu calendario.')
  })
})
