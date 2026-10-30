import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { avisosVenta } from '../lib/avisos'
import { aplicarDescuentoGeneral } from '../__testing__/descuentoGeneral'

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockTipo = 'Pedido'
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => mockBoton(`redirige a ${href}`, jest.fn()),
}))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
// La lista de clientes y el catálogo tienen sus tests: acá solo se elige y se agrega.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('../components/ElegirClienteVenta', () => ({
  ElegirClienteVenta: ({ onElegir }: { onElegir: (c: object) => void }) =>
    mockBoton('Elegir Tarantino', () => onElegir({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' })),
}))
jest.mock('../components/CatalogoVenta', () => ({ CatalogoVenta: ({ onVerVenta }: { onVerVenta: () => void }) => mockBoton('Ver venta', onVerVenta) }))

const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const URL_DEFECTO = '/api/v1/Ventas/con-factura-por-defecto'
let porDefecto: unknown
const pala = producto({ real: 100, disponible: 100 })

function pantalla() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla /></QueryClientProvider>)
}
async function abrirConfirmar() {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  useCarritoVenta.setState({ lineas: [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }] })
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith(URL_DEFECTO))
  await screen.findByRole('switch', { name: 'Con factura' })
}
const cuerpoDelAlta = () => mockPost.mock.calls.find((c) => c[0] === '/api/v1/Ventas')?.[1]

beforeEach(() => {
  porDefecto = { ventaConFacturaPorDefecto: true }
  mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
  mockPut.mockReset().mockImplementation((_u: string, body: { version: number }) => Promise.resolve({ ventaId: 'b1', version: body.version + 1, message: 'ok' }))
  mockGet.mockReset().mockImplementation((url: string) => Promise.resolve(
    url === URL_DEFECTO ? porDefecto : url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : undefined))
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useCarritoVenta.setState({ lineas: [] })
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never })
})

// Igual que la web (venta-form.tsx:274-278 y ConFacturaField): el tilde nace con el default de ventas
// (GET /Ventas/con-factura-por-defecto), el vendedor lo cambia, y viaja el valor efectivo; sin default, se omite.
describe('V7 Confirmar: Con factura', () => {
  it('nace con el valor por defecto del servidor y viaja en el alta', async () => {
    await abrirConfirmar()
    const sw = await screen.findByRole('switch', { name: 'Con factura' })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).toBeChecked())
    expect(sw).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().conFactura).toBe(true)
  })

  it('si el vendedor lo apaga, viaja false aunque el default sea true', async () => {
    await abrirConfirmar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).toBeChecked())
    await userEvent.press(screen.getByRole('switch', { name: 'Con factura' }))
    expect(screen.getByRole('switch', { name: 'Con factura' })).not.toBeChecked()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().conFactura).toBe(false)
  })

  it('default false: nace apagado y viaja false', async () => {
    porDefecto = { ventaConFacturaPorDefecto: false }
    await abrirConfirmar()
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(URL_DEFECTO))
    expect(await screen.findByRole('switch', { name: 'Con factura' })).not.toBeChecked()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().conFactura).toBe(false)
  })

  it('sin el default (no llegó): el tilde está deshabilitado y el alta no manda conFactura (lo decide el servidor)', async () => {
    mockGet.mockImplementation((url: string) => url === URL_DEFECTO ? Promise.reject(new Error('sin red'))
      : Promise.resolve(url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : undefined))
    await abrirConfirmar()
    expect(screen.getByRole('switch', { name: 'Con factura' })).toBeDisabled()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta()).not.toHaveProperty('conFactura')
  })
})
