/**
 * Bloque 9A (PR 0.4) — el menú solo ofrece los módulos del alcance aprobado.
 *
 * Con un usuario con TODOS los permisos y TODOS los roles (el caso en que más
 * entradas se ven), el menú no debe ofrecer proveedores, cargas masivas, ABM de
 * usuarios/perfiles/roles, depósitos, viajes, vehículos ni picking.
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import CustomDrawerContent from '../CustomDrawerContent'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/drawer', () => ({ useDrawerStatus: () => 'closed' }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-blur', () => ({ BlurView: () => null }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))
jest.mock('@/libs/theme', () => ({
  useColors: () => new Proxy({}, { get: () => '#000000' }),
  useThemeStore: () => ({ mode: 'light' }),
}))
jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({ canDo: () => true }),
}))
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ refreshPermissions: jest.fn(), logout: jest.fn() }),
}))
jest.mock('@/libs/store/auth.store', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: {
      nombre: 'Test',
      roles: ['Administrador', 'AdministradorSistemas', 'Gerencia', 'Empleado', 'Vendedor'],
    },
  }),
}))

const props = { state: { routeNames: ['index'], index: 0 } } as any

const FUERA_DE_ALCANCE = [
  'Usuarios',
  'Depósitos',
  'Proveedores',
  'Cargas masivas',
  'Viajes',
  'Vehículos',
  'Picking',
  'Perfiles',
  'Roles',
]

const APROBADOS = [
  'Ventas / Presupuestos',
  'Compras',
  'Control de Stock',
  'Movimientos',
  'Cuentas Ctes.',
  'Clientes',
  'Consola del Chofer',
  'Mi cuenta',
]

const RUTAS_FUERA_DE_ALCANCE = [
  '/usuarios',
  '/inventario/depositos',
  '/inventario/nuevo',
  '/logistica/viajes',
  '/logistica/vehiculos',
  '/logistica/picking',
]

describe('CustomDrawerContent — recorte al alcance aprobado', () => {
  beforeEach(() => mockPush.mockClear())

  it('no ofrece ningún módulo fuera de alcance, ni siquiera a un administrador', () => {
    const { queryByText } = render(<CustomDrawerContent {...props} />)

    for (const nombre of FUERA_DE_ALCANCE) {
      expect(queryByText(new RegExp(nombre, 'i'))).toBeNull()
    }
  })

  it('ofrece los módulos aprobados', () => {
    const { getByText } = render(<CustomDrawerContent {...props} />)

    for (const nombre of APROBADOS) {
      expect(getByText(nombre)).toBeTruthy()
    }
  })

  it('ninguna entrada del menú navega a una ruta fuera de alcance', () => {
    const { getByText } = render(<CustomDrawerContent {...props} />)

    for (const nombre of [...APROBADOS, 'Logística', 'Panel Central']) {
      fireEvent.press(getByText(nombre))
    }

    const rutas = mockPush.mock.calls.map(([ruta]) => String(ruta))
    expect(rutas.length).toBe(APROBADOS.length + 2)
    for (const fuera of RUTAS_FUERA_DE_ALCANCE) {
      expect(rutas.some((r) => r.includes(fuera))).toBe(false)
    }
  })
})
