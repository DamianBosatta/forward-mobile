import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { crearQueryClient } from '@/core/query/queryClient'
import { MiDiaScreen } from '../components/MiDiaScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string, o?: unknown) => (o === undefined ? mockGet(url) : mockGet(url, o)) },
}))
const { ApiError } = jest.requireActual('@/core/api/client')

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('expo-router/react-navigation', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useFocusEffect: jest.fn(),
}))
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: 390, height: 800, isTablet: false, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n }),
}))

const pend = (cantidad: number) => ({ cantidad, importes: [] })
const RESUMEN_INICIO = { ventas: { presupuestosPendientes: pend(3), pedidosConfirmados: pend(5), porAutorizar: pend(2) }, compras: null, autorizacionesPendientes: null }
const RESUMEN_VENDEDOR = {
  anio: 2026, mes: 10, periodo: {}, puedeElegirVendedor: false,
  ventas: { facturado: 3420000, operaciones: 14, ticketPromedio: 1, cobrado: 1 },
  comisiones: { devengado: 1, reversiones: 0, neto: 171000, pagado: 0, saldoActual: 1 },
  cobrosPendientes: { total: 640300, clientes: 4, detalle: [] },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((url: string) => {
    if (url.includes('Inicio/resumen')) return Promise.resolve(RESUMEN_INICIO)
    if (url.includes('resumen-vendedor')) return Promise.resolve(RESUMEN_VENDEDOR)
    return Promise.reject(new ApiError(404, 'no'))
  })
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-17T15:00:00Z').getTime())
})
afterEach(() => jest.restoreAllMocks())

const INICIO = '/api/v1/Inicio/resumen'
const VENDEDOR = '/api/v1/Reportes/mobile/resumen-vendedor?anio=2026&mes=10'
const DASHBOARD = '/api/v1/Dashboard/summary'
const HOY = '/api/v1/Ventas?pageNumber=1&pageSize=1&fechaDesde=2026-10-17&fechaHasta=2026-10-17'
const RECIENTES = '/api/v1/socios-comerciales/clientes-recientes?limite=5'

/** Mi día con la propuesta pide lo mismo que antes, según los permisos (frame 5: "No cambia qué endpoints se llaman"). */
describe('Mi día: qué endpoints llama según los permisos', () => {
  it.each([
    ['Ventas', [{ module: 'MOD_VENTAS', canRead: true, canCreate: true }], [INICIO, VENDEDOR, DASHBOARD, HOY]],
    ['Ventas, Compras y Clientes', [{ module: 'MOD_VENTAS', canRead: true, canCreate: true }, { module: 'MOD_COMPRAS', canRead: true }, { module: 'MOD_CLIENTES', canRead: true }], [INICIO, VENDEDOR, DASHBOARD, HOY, RECIENTES]],
    ['crear ventas sin leerlas', [{ module: 'MOD_VENTAS', canRead: false, canCreate: true }], []],
    ['sin permisos', [], []],
  ])('%s', async (_nombre, permisos, esperadas) => {
    useAuthStore.setState({ user: { id: 'u1', username: 'emanuel', nombre: 'Emanuel', apellido: 'P', roles: [], permissions: permisos } } as never)
    render(
      <QueryClientProvider client={crearQueryClient({ retry: false })}>
        <MiDiaScreen />
      </QueryClientProvider>,
    )
    await new Promise((r) => setTimeout(r, 300))
    await waitFor(() => expect([...new Set(mockGet.mock.calls.map((c) => c[0] as string))].sort()).toEqual([...esperadas].sort()))
  })
})
