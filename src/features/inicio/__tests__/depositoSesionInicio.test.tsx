import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useThemeStore } from '@/libs/theme'
import { limpiarDepositoDeSesion } from '@/features/deposito-sesion'
import { InicioScreen } from '../components/InicioScreen'
import { MiDiaScreen } from '../components/MiDiaScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: jest.fn(), delete: jest.fn() },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('expo-router/react-navigation', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useFocusEffect: jest.fn(),
}))
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: 390, height: 800, isTablet: false, isLarge: false, scale: (n: number) => n }),
}))

const SALTA = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const usuario = (caps: string[]) =>
  useAuthStore.setState({
    user: { id: 'u1', username: 'ana', nombre: 'Ana', roles: [], depositoId: SALTA, permissions: caps.map((module) => ({ module, canRead: true })) } as never,
  })

function pintar(Pantalla: React.ComponentType) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><Pantalla /></QueryClientProvider>)
}

beforeEach(() => {
  limpiarDepositoDeSesion()
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/api/v1/Depositos')
      ? Promise.resolve([{ id: SALTA, nombre: 'Salta', activo: true }, { id: NORTE, nombre: 'Zona Norte', activo: true }])
      : Promise.reject(new Error(`sin respuesta: ${url}`)))
})

describe.each(['light', 'dark'] as const)('depósito de la sesión en Inicio (%s)', (tema) => {
  beforeEach(() => useThemeStore.setState({ mode: tema }))

  describe.each([['Mi día', MiDiaScreen], ['Inicio de gestión', InicioScreen]] as const)('%s', (_n, Pantalla) => {
    it('sin CAP_VER_TODOS_LOS_DEPOSITOS no hay selector', () => {
      usuario(['MOD_VENTAS'])
      pintar(Pantalla)
      expect(screen.queryByTestId('deposito-sesion')).toBeNull()
    })

    it('con la capacidad muestra el depósito actual y la hoja lo cambia', async () => {
      usuario(['MOD_VENTAS', 'CAP_VER_TODOS_LOS_DEPOSITOS'])
      pintar(Pantalla)
      await userEvent.press(await screen.findByRole('button', { name: 'Depósito: Salta' }))
      await userEvent.press(within(screen.getByTestId('hoja-depositos')).getByRole('button', { name: 'Zona Norte' }))
      expect(screen.getByRole('button', { name: 'Depósito: Zona Norte' })).toBeTruthy()
    })
  })
})
