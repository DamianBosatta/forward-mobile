import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { BandejaAutorizaciones } from '../components/BandejaAutorizaciones'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isTablet: mockAncho() >= 600, isTabletLandscape: mockAncho() >= 900, isLarge: mockAncho() >= 600 }),
}))

const venta = (id: string, motivo: number, total: number, extra: object = {}) => ({
  id,
  clienteId: `c-${id}`,
  clienteDisplayName: `Dirección ${id} - Cliente ${id}`,
  vendedorId: 'v1',
  vendedorNombre: 'Emanuel Parraquini',
  totalAmount: total,
  totalCurrency: 'ARS',
  fechaPendiente: '2026-10-11T10:00:00Z',
  motivoPendienteAutorizacion: motivo,
  ...extra,
})

function conCapacidades(...caps: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'marina', roles: [], permissions: ['MOD_VENTAS', ...caps].map((module) => ({ module, canRead: true })) },
  } as never)
}

function bandeja(lista: unknown) {
  mockGet.mockImplementation(() => (lista instanceof Error ? Promise.reject(lista) : Promise.resolve(lista)))
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BandejaAutorizaciones rutaDetalle={(id) => `/detalle/${id}`} detalle={(id) => <></>} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
})

describe('Autorizaciones: la bandeja', () => {
  it('muestra cada venta con todos sus motivos, los filtros con su cantidad y el total de la lista', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 32 | 4, 1000.5), venta('b', 2, 500)])
    pintar()

    expect(await screen.findByText('• Supera el tope de crédito del cliente')).toBeTruthy()
    expect(screen.getByText('• Supera el tope de descuento del vendedor')).toBeTruthy()
    expect(screen.getByText(/margen en amarillo/)).toBeTruthy()
    expect(screen.getByLabelText('Todas: 2')).toBeTruthy()
    expect(screen.getByLabelText('Crédito: 1')).toBeTruthy()
    expect(screen.queryByLabelText(/Sin stock/)).toBeNull()
    expect(screen.getByText('2 POR AUTORIZAR · $ 1.500,50')).toBeTruthy()

    await userEvent.press(screen.getByLabelText('Margen: 1'))
    expect(screen.queryByText('Dirección a - Cliente a')).toBeNull()
    expect(screen.getByText('1 POR AUTORIZAR · $ 500,00')).toBeTruthy()
  })

  it('con monedas distintas no suma un total', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100), venta('b', 4, 100, { totalCurrency: 'USD' })])
    pintar()
    expect(await screen.findByText('2 POR AUTORIZAR')).toBeTruthy()
  })

  it('sin CAP_AUTORIZAR_VENTA no pide la bandeja y lo explica', async () => {
    conCapacidades()
    bandeja([venta('a', 4, 100)])
    pintar()
    expect(screen.getByText(/necesita el permiso de autorizar ventas/)).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza, muestra su mensaje', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja(new Error('Solo Administración o Gerencia pueden ver la bandeja de autorizaciones.'))
    pintar()
    expect(await screen.findByText('Solo Administración o Gerencia pueden ver la bandeja de autorizaciones.')).toBeTruthy()
  })

  it('en teléfono, tocar la tarjeta abre el detalle', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)])
    pintar()
    await userEvent.press(await screen.findByLabelText('Ver la venta de Dirección a - Cliente a'))
    expect(mockPush).toHaveBeenCalledWith('/detalle/a')
  })

  it('en tablet horizontal el detalle se abre al lado, sin salir de la lista', async () => {
    mockAncho.mockReturnValue(1194)
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)])
    pintar()

    await userEvent.press(await screen.findByLabelText('Ver la venta de Dirección a - Cliente a'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('two-pane-detail')).queryByText('Elegí una venta para decidir.')).toBeNull()
  })
})
