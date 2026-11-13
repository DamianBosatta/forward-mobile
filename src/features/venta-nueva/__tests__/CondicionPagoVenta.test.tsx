import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useThemeStore } from '@/libs/theme'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'

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
const pala = producto({ real: 100, disponible: 100 })
let condiciones: unknown[]

const socio = () => ({ id: 'c1', direccion: 'Tarantino 1898', condicionesPagoCliente: condiciones, puedeEditarCondicionesPago: false, condicionPago: { tipo: 'Contado' } })

function pantalla() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla /></QueryClientProvider>)
}
async function abrirRevision(tipo: 'Pedido' | 'Presupuesto' = 'Pedido') {
  pantalla()
  if (tipo === 'Presupuesto') await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  useCarritoVenta.setState({ lineas: [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }] })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled())
  await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('radio', { name: 'Contado' })
}
const cuerpoDelAlta = () => mockPost.mock.calls.find((c) => c[0] === '/api/v1/Ventas')?.[1]

describe.each([['light', 390], ['dark', 390], ['light', 820], ['dark', 820]] as const)('condición de pago de la venta, tema %s, ancho %s', (modo, ancho) => {
  beforeEach(() => {
    useThemeStore.setState({ mode: modo })
    condiciones = [{ tipo: 'DiasDesdeEntrega', dias: 15, predeterminada: true }, { tipo: 'DiasDesdeFactura', dias: 30, predeterminada: false }]
    mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
    mockPut.mockReset()
    mockGet.mockReset().mockImplementation((url: string) => Promise.resolve(
      url.includes('con-factura-por-defecto') ? { ventaConFacturaPorDefecto: true }
        : url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : url.includes('socios-comerciales/c1') ? socio() : undefined))
    mockDims.mockReturnValue({ width: ancho, height: 800, scale: 2, fontScale: 1 })
    useCarritoVenta.setState({ lineas: [] })
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never })
  })
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('preselecciona la predeterminada del cliente y ofrece Contado aunque no la tenga habilitada', async () => {
    await abrirRevision()
    await waitFor(() => expect(screen.getByRole('radio', { name: /15 días desde la entrega.*predeterminada/ })).toBeChecked())
    expect(screen.getByRole('radio', { name: /30 días desde la factura/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Contado' })).toBeTruthy()
  })

  it('el alta manda la condición vigente en condicionPago', async () => {
    await abrirRevision()
    await waitFor(() => expect(screen.getByRole('radio', { name: /15 días desde la entrega/ })).toBeChecked())
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().condicionPago).toEqual({ tipo: 'DiasDesdeEntrega', dias: 15 })
  })

  it('si el vendedor elige Contado, viaja Contado', async () => {
    await abrirRevision()
    await waitFor(() => expect(screen.getByRole('radio', { name: /15 días desde la entrega/ })).toBeChecked())
    await userEvent.press(screen.getByRole('radio', { name: 'Contado' }))
    expect(screen.getByRole('radio', { name: 'Contado' })).toBeChecked()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().condicionPago).toEqual({ tipo: 'Contado' })
  })

  it('un Presupuesto nuevo también ofrece la condición, con la predeterminada del cliente', async () => {
    mockPut.mockResolvedValue({ ventaId: 'b1', version: 8 })
    await abrirRevision('Presupuesto')
    await waitFor(() => expect(screen.getByRole('radio', { name: /15 días desde la entrega.*predeterminada/ })).toBeChecked())
    expect(screen.getByRole('radio', { name: 'Contado' })).toBeTruthy()
  })

  it('el Presupuesto guarda la condición elegida en el autoguardado del borrador', async () => {
    mockPut.mockResolvedValue({ ventaId: 'b1', version: 8 })
    await abrirRevision('Presupuesto')
    await userEvent.press(screen.getByRole('radio', { name: 'Contado' }))
    await waitFor(() => expect(mockPut.mock.calls.some((c) => c[1]?.condicionPago?.tipo === 'Contado')).toBe(true), { timeout: 5000 })
  })

  it('avisa lo del manifiesto solo cuando no es contado', async () => {
    await abrirRevision()
    expect(await screen.findByText(/en el manifiesto el chofer ve "NO COBRAR"/)).toBeTruthy()
    await userEvent.press(screen.getByRole('radio', { name: 'Contado' }))
    expect(screen.queryByText(/NO COBRAR/)).toBeNull()
  })
})
