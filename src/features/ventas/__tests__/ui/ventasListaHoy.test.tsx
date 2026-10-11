import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'

// Lista de ventas de hoy (switch de la venta nueva apagado) con su hook y su DataList de verdad.
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: {} }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }) }))
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
jest.mock('@/features/ventas/components/ListaVentasNueva', () => ({ ListaVentasNueva: () => null }))
jest.mock('../../../../../app/(tabs)/ventas/[id]', () => ({ VentaDetalle: () => null }))

import VentasRoute from '../../../../../app/(tabs)/ventas/index'

const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: ['Vendedor'] as never, permissions: [] }, isAuthenticated: true })
  useVentaNuevaStore.setState({ activa: false })
  mockGet.mockReset()
})

describe('lista de ventas de hoy: error al pedir un chip', () => {
  it('muestra el error con "Reintentar" debajo de los chips: reintentar vuelve a pedir ese estado y "Todas" vuelve a la lista', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/v1/Ventas/resumen?')) return Promise.resolve({ totalVendido: 0, pendientes: 0, porAutorizar: 0, entregadas: 0, cantidad: 0 })
      if (url.includes('estados=Entregada')) return Promise.reject(new Error('No se pudo conectar con el servidor.'))
      return Promise.resolve(pagina([{ id: 'v1', razonSocialCliente: 'Almacén Luis', estado: 'Pendiente', fecha: '2026-10-01T12:00:00Z', totalAmount: 1000 }]))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><VentasRoute /></QueryClientProvider>)

    // El chip se toca con "Todas" ya cargada.
    await screen.findByText('Almacén Luis')
    await userEvent.press(screen.getByText('Entregada'))
    await userEvent.press(await screen.findByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(mockGet.mock.calls.filter(([u]) => String(u).includes('estados=Entregada')).length).toBeGreaterThan(1))
    // Con el error a la vista siguen los chips: "Todas" vuelve a la lista.
    await screen.findByRole('button', { name: 'Reintentar carga' })
    await userEvent.press(screen.getByText('Todas'))
    expect(await screen.findByText('Almacén Luis')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar carga' })).toBeNull()
  })
})
