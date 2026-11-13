import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { crearQueryClient } from '@/core/query/queryClient'
import { TEMAS, conTema } from '@/core/ui/fw/__testing__/tema'
import { InicioDeposito } from '../components/InicioDeposito'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('expo-router/react-navigation', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useFocusEffect: jest.fn(),
}))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), height: 800, isTablet: mockAncho() >= 600, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n }),
}))

const pend = (cantidad: number) => ({ cantidad, importes: [] })
const RESUMEN = { ventas: null, compras: { porRecibir: pend(2), porPagar: pend(0) }, autorizacionesPendientes: null }

function servidor(r: { dashboard?: unknown; inicio?: unknown }) {
  mockGet.mockImplementation((url: string) => {
    const valor = url.includes('Dashboard/summary') ? r.dashboard : url.includes('Inicio/resumen') ? r.inicio : undefined
    if (valor instanceof Error) return Promise.reject(valor)
    return valor === undefined ? Promise.reject(new Error(`sin respuesta: ${url}`)) : Promise.resolve(valor)
  })
}
const conPermisos = (...modulos: string[]) =>
  useAuthStore.setState({ user: { id: 'u1', username: 'ana', nombre: 'Ana', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) } } as never)
const pintar = () => render(<QueryClientProvider client={crearQueryClient({ retry: false })}><InicioDeposito /></QueryClientProvider>)

afterEach(() => conTema('light'))

describe.each(TEMAS)('InicioDeposito (%s)', (tema) => {
  describe.each([['teléfono', 390], ['tablet', 1194]] as const)('en %s', (_n, ancho) => {
    beforeEach(() => {
      jest.clearAllMocks()
      conTema(tema)
      mockAncho.mockReturnValue(ancho)
    })

    it('con stock y compras: lo que está bajo el mínimo y lo que falta recibir, y cada fila abre su lista', async () => {
      conPermisos('MOD_STOCK', 'MOD_COMPRAS')
      servidor({ dashboard: { lowStockAlerts: 4 }, inicio: RESUMEN })
      pintar()
      const hero = await screen.findByTestId('deposito-hero')
      expect(within(hero).getByText('Bajo el mínimo')).toBeTruthy()
      expect(within(hero).getByText('4 productos')).toBeTruthy()
      const user = userEvent.setup()
      await user.press(await screen.findByText('4 productos bajo el mínimo'))
      expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/inventario/stock')
      await user.press(await screen.findByText('2 compras confirmadas'))
      expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/compras?estado=Confirmado')
      expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
    })

    it('0 productos bajo el mínimo: "Todo en orden", nunca un 0 suelto', async () => {
      conPermisos('MOD_STOCK')
      servidor({ dashboard: { lowStockAlerts: 0 } })
      pintar()
      expect(await within(await screen.findByTestId('deposito-hero')).findByText('Todo en orden')).toBeTruthy()
      expect(screen.queryByText('Por recibir')).toBeNull()
    })

    it('sin dato del servidor muestra "—"', async () => {
      conPermisos('MOD_STOCK')
      servidor({ dashboard: { lowStockAlerts: null } })
      pintar()
      expect(await within(await screen.findByTestId('deposito-hero')).findByText('—')).toBeTruthy()
    })

    it('mientras carga el stock muestra el bloque de carga', () => {
      conPermisos('MOD_STOCK')
      mockGet.mockImplementation(() => new Promise(() => {}))
      pintar()
      expect(screen.getByTestId('hero-cargando')).toBeTruthy()
    })

    it('si el stock falla lo dice con "Reintentar" y no inventa una cifra', async () => {
      conPermisos('MOD_STOCK')
      servidor({ dashboard: new Error('boom') })
      pintar()
      expect(await screen.findByText('No se pudo cargar el stock.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reintentar stock' })).toBeTruthy()
      expect(screen.queryByTestId('deposito-hero')).toBeNull()
    })

    it('solo con Compras no pide ni dibuja el stock', async () => {
      conPermisos('MOD_COMPRAS')
      servidor({ inicio: RESUMEN })
      pintar()
      expect(await screen.findByText('2 compras confirmadas')).toBeTruthy()
      expect(screen.queryByTestId('deposito-hero')).toBeNull()
      expect(mockGet.mock.calls.some(([u]) => String(u).includes('Dashboard/summary'))).toBe(false)
    })

    it('sin Stock ni Compras: estado de sin permiso, sin tableros', () => {
      conPermisos('MOD_CLIENTES')
      servidor({})
      pintar()
      expect(screen.getByText('Tu usuario no tiene tableros para mostrar')).toBeTruthy()
      expect(screen.queryByTestId('deposito-hero')).toBeNull()
    })
  })
})
