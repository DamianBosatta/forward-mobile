import { fireEvent, render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
  zustandStorage: { setItem: () => undefined, getItem: () => null, removeItem: () => undefined },
}))
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => () => undefined) }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

import { cambiarEstado, encolarVenta } from '../lib/cola'
import { PendientesDeEnviar } from '../components/PendientesDeEnviar'

const alta: AltaVenta = {
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-p1',
}
const montar = () => render(<QueryClientProvider client={new QueryClient()}><PendientesDeEnviar /></QueryClientProvider>)

beforeEach(() => { mockDisco.clear(); mockPush.mockReset(); useAuthStore.setState({ user: { id: 'u1' } as never }) })

it('sin ventas en el teléfono no dibuja nada', () => {
  expect(montar().toJSON()).toBeNull()
})

it('con ventas del usuario muestra el bloque "Pendientes de enviar" con la venta que espera', () => {
  encolarVenta('u1', { alta, cliente: { razonSocial: 'Almacén Luis' } as never, visto: { total: 600, precios: { p1: 100 } } })
  montar()
  expect(screen.getByText('Pendientes de enviar')).toBeTruthy()
  expect(screen.getByText('En el teléfono')).toBeTruthy()
})

it('no muestra las ventas de otro usuario', () => {
  encolarVenta('otro', { alta, cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
  expect(montar().toJSON()).toBeNull()
})

it('tocar una venta ya enviada abre su detalle', () => {
  encolarVenta('u1', { alta, cliente: { razonSocial: 'Almacén Luis' } as never, visto: { total: 600, precios: { p1: 100 } } })
  cambiarEstado('u1', 'mobile-p1', { tipo: 'enviada', ventaId: 'v9', codigo: 'A1', estado: null })
  montar()
  fireEvent.press(screen.getByText(/Almac/))
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/v9')
})
