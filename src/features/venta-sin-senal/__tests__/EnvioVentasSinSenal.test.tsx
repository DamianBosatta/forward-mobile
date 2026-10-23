import { render, waitFor } from '@testing-library/react-native'
import { api } from '@/core/api/client'
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
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  API_URL: '',
}))
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => () => undefined) }))

import { encolarVenta, leerCola } from '../lib/cola'
import { EnvioVentasSinSenal } from '../components/EnvioVentasSinSenal'

const post = api.post as jest.Mock
const alta: AltaVenta = {
  clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
  descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-abc',
}

it('montado en la app, manda solo lo que quedó en el teléfono del usuario logueado', async () => {
  useAuthStore.setState({ user: { id: 'u1' } as never })
  ;(api.get as jest.Mock).mockResolvedValue({ venta: { codigoPedido: 'A1', estado: 2 } })
  post.mockImplementation(async (url: string) => url.endsWith('vista-previa')
    ? { rechazos: [], total: 600, lineas: [{ productoId: 'p1', precioBase: 100 }] }
    : { ventaId: 'v1', version: 1, message: '', estado: 2 })
  encolarVenta('u1', { alta, cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
  const { toJSON } = render(<EnvioVentasSinSenal />)
  expect(toJSON()).toBeNull()
  await waitFor(() => expect(leerCola('u1')[0].estado).toMatchObject({ tipo: 'enviada', ventaId: 'v1' }))
})
