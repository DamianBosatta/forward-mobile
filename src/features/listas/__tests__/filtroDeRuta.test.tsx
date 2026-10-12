import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'

// Las filas de Inicio abren Ventas y Compras con el filtro en la ruta (?tipo=…&estado=…).
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
let mockParams: Record<string, string | undefined> = {}
const mockSetParams = jest.fn((p: Record<string, string | undefined>) => { mockParams = { ...mockParams, ...p } })
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: {} }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({ canDo: () => true }),
}))
jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  const Pasa = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>
  return { ForwardLogo: Pasa, TopHeaderActions: Pasa, RequirePermission: Pasa, GlassCard: Pasa, AuroraGlow: Pasa, SegmentedControl: Pasa }
})
jest.mock('@/core/ui/PremiumInput', () => ({ PremiumInput: () => null }))
jest.mock('@/features/ventas/components/VentasKpiGrid', () => ({ VentasKpiGrid: () => null }))
jest.mock('@/features/ventas/components/VentaCardSkeleton', () => ({ VentaCardSkeleton: () => null }))
jest.mock('moti', () => ({ MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
let mockAncho = 390
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: mockAncho, height: 800, scale: 2, fontScale: 1 }) }))
jest.mock('../../../../app/(tabs)/ventas/[id]', () => ({ VentaDetalle: () => null }))
jest.mock('../../../../app/(tabs)/compras/[id]', () => {
  const { Text: T } = require('react-native')
  return { CompraDetalle: ({ id }: { id: string }) => <T>{`detalle ${id}`}</T> }
})
jest.mock('@/features/venta-nueva/components/DetalleVentaNueva', () => {
  const { Text: T } = require('react-native')
  return { DetalleVentaNueva: ({ id }: { id: string }) => <T>{`detalle ${id}`}</T> }
})

import VentasRoute from '../../../../app/(tabs)/ventas/index'
import ComprasRoute from '../../../../app/(tabs)/compras/index'

const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })

/** Parámetros de la última llamada a esa lista (lo que se le pidió al servidor). */
function ultimaConsulta(lista: '/api/v1/Ventas?' | '/api/v1/Compras?'): URLSearchParams {
  const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith(lista))
  return new URLSearchParams(urls[urls.length - 1]!.split('?')[1])
}

/** `rerender` pinta un elemento nuevo: la ruta vuelve a leer los parámetros (como al navegar). */
function pintar(Ruta: React.ComponentType) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const r = render(<QueryClientProvider client={qc}><Ruta /></QueryClientProvider>)
  return { rerender: () => r.rerender(<QueryClientProvider client={qc}><Ruta /></QueryClientProvider>) }
}

function loguear(roles: string[]) {
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: roles as never, permissions: [] }, isAuthenticated: true })
}

beforeEach(() => {
  mockGet.mockReset()
  mockSetParams.mockClear()
  mockParams = {}
  mockAncho = 390
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/resumen')) return Promise.resolve({ cantidad: 1, notasPedido: 1, confirmadas: 0, entregadas: 0 })
    if (url.includes('borradores/mios')) return Promise.resolve([])
    // La venta viene en el estado pedido (la lista de hoy también filtra en el teléfono); sin estado, otra.
    const estado = new URLSearchParams(url.split('?')[1]).get('estados')
    const cliente = estado === 'PendienteAutorizacion' ? 'Kiosco Ana' : 'Almacén Luis'
    return Promise.resolve(pagina([{ id: 'v1', razonSocialCliente: cliente, razonSocialProveedor: cliente, vendedorNombre: 'Emanuel Parraquini', estado: estado ?? 'Pendiente', fecha: new Date().toISOString(), totalAmount: 1000 }]))
  })
})

describe('Ventas (lista de hoy) con el filtro de Inicio', () => {
  beforeEach(() => { loguear(['Vendedor']); useVentaNuevaStore.setState({ activa: false }) })

  it('pide tipo y estado al servidor sin el filtro del mes, y se saca el filtro de la ruta', async () => {
    mockParams = { tipo: 'presupuestos', estado: 'Pendiente' }
    pintar(VentasRoute)

    await screen.findByText('Almacén Luis')
    const q = ultimaConsulta('/api/v1/Ventas?')
    expect(q.get('tipoOperacion')).toBe('1')
    expect(q.getAll('estados')).toEqual(['Pendiente'])
    // Inicio cuenta sin fecha: la lista tampoco filtra por mes.
    expect(q.get('fechaDesde')).toBeNull()
    expect(mockSetParams).toHaveBeenCalledWith({ tipo: undefined, estado: undefined })
  })

  it('la misma fila vuelve a aplicar el filtro aunque se haya cambiado a mano', async () => {
    mockParams = { tipo: 'pedidos', estado: 'PendienteAutorizacion' }
    const { rerender } = pintar(VentasRoute)
    await screen.findByText('Kiosco Ana')
    expect(ultimaConsulta('/api/v1/Ventas?').getAll('estados')).toEqual(['PendienteAutorizacion'])

    rerender() // la ruta ya sin el filtro
    await userEvent.press(screen.getByText('Todas'))
    await screen.findByText('Almacén Luis')

    mockParams = { tipo: 'pedidos', estado: 'PendienteAutorizacion' }
    rerender()
    await screen.findByText('Kiosco Ana')
    expect(screen.queryByText('Almacén Luis')).toBeNull()
  })

  it('sin filtro en la ruta sigue arrancando en el mes actual', async () => {
    pintar(VentasRoute)
    await screen.findByText('Almacén Luis')
    expect(ultimaConsulta('/api/v1/Ventas?').get('fechaDesde')).not.toBeNull()
    expect(mockSetParams).not.toHaveBeenCalled()
  })
})

describe('Ventas (lista nueva) con el filtro de Inicio', () => {
  it('abre la pestaña y el estado pedidos, en "Todo" el período', async () => {
    loguear(['Administrador'])
    useVentaNuevaStore.setState({ activa: true })
    mockParams = { tipo: 'presupuestos', estado: 'Pendiente' }
    pintar(VentasRoute)

    await screen.findByText('Almacén Luis')
    const q = ultimaConsulta('/api/v1/Ventas?')
    expect(q.get('tipoOperacion')).toBe('1')
    expect(q.get('estado')).toBe('Pendiente')
    expect(q.get('fechaDesde')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Presupuestos' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Pendiente' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Todo' })).toBeSelected()
  })
})

describe('Compras con el filtro de Inicio', () => {
  it('"Por recibir" abre Pendientes solo con las confirmadas; "Todas" vuelve a las dos', async () => {
    mockParams = { estado: 'Confirmado' }
    pintar(ComprasRoute)

    await screen.findByText('Almacén Luis')
    expect(ultimaConsulta('/api/v1/Compras?').getAll('Estados')).toEqual(['Confirmado'])
    expect(screen.getByRole('radio', { name: 'Por recibir' })).toBeSelected()

    await userEvent.press(screen.getByRole('radio', { name: 'Todas' }))
    await waitFor(() => expect(ultimaConsulta('/api/v1/Compras?').getAll('Estados')).toEqual(['NotaPedido', 'Confirmado']))
  })

  it('un estado que no es de Pendientes no filtra', async () => {
    mockParams = { estado: 'Anulado' }
    pintar(ComprasRoute)
    await screen.findByText('Almacén Luis')
    expect(ultimaConsulta('/api/v1/Compras?').getAll('Estados')).toEqual(['NotaPedido', 'Confirmado'])
  })
})

describe('tablet: el filtro que llega de Inicio cierra el detalle que ya no está en la lista', () => {
  const fila = (id: string, nombre: string, estado: string) => ({
    id, razonSocialCliente: nombre, razonSocialProveedor: nombre, vendedorNombre: 'Emanuel Parraquini', estado, fecha: new Date().toISOString(), totalAmount: 1000,
  })
  beforeEach(() => { mockAncho = 1100 })

  it('Compras: la compra abierta sale con el filtro y su detalle se cierra; la que queda, sigue', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/resumen')) return Promise.resolve({ notasPedido: 1, confirmadas: 1, entregadas: 0 })
      const estados = new URLSearchParams(url.split('?')[1]).getAll('Estados')
      const nota = fila('c1', 'Gorrión Mayorista', 'NotaPedido')
      return Promise.resolve(pagina(estados.length === 1 && estados[0] === 'NotaPedido' ? [nota] : [nota, fila('c2', 'Insumos del Sur', 'Confirmado')]))
    })
    const { rerender } = pintar(ComprasRoute)
    await userEvent.press(await screen.findByText('Insumos del Sur'))
    expect(await screen.findByText('detalle c2')).toBeTruthy()

    mockParams = { estado: 'NotaPedido' }
    rerender()
    await waitFor(() => expect(screen.queryByText('detalle c2')).toBeNull(), { timeout: 5000 })
    expect(screen.queryByText('Insumos del Sur')).toBeNull()

    await userEvent.press(screen.getByText('Gorrión Mayorista'))
    mockParams = { estado: 'NotaPedido' }
    rerender()
    expect(await screen.findByText('detalle c1')).toBeTruthy()
  })

  it('Ventas (lista nueva): igual con la venta abierta', async () => {
    loguear(['Administrador'])
    useVentaNuevaStore.setState({ activa: true })
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/resumen')) return Promise.resolve({ cantidad: 1 })
      const estado = new URLSearchParams(url.split('?')[1]).get('estado')
      const confirmada = fila('v1', 'Almacén Luis', 'Confirmada')
      return Promise.resolve(pagina(estado === 'Confirmada' ? [confirmada] : [confirmada, fila('v2', 'Kiosco Ana', 'Pendiente')]))
    })
    const { rerender } = pintar(VentasRoute)
    await userEvent.press(await screen.findByText('Kiosco Ana'))
    expect(await screen.findByText('detalle v2')).toBeTruthy()

    mockParams = { tipo: 'pedidos', estado: 'Confirmada' }
    rerender()
    await waitFor(() => expect(screen.queryByText('detalle v2')).toBeNull(), { timeout: 5000 })
    expect(screen.getByText('Almacén Luis')).toBeTruthy()
  })
})
