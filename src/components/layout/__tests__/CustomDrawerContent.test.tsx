/**
 * Bloque 9A — el menú lateral.
 *
 * PR 0.4: solo ofrece los módulos del alcance aprobado, ni siquiera a un administrador.
 * PR 0.3: los nombres siguen la lámina Menu ("Ventas", "Catálogo y stock",
 * "Cuentas corrientes"...) y cada usuario ve solo lo que sus permisos le dejan usar.
 */
import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import CustomDrawerContent from '../CustomDrawerContent'

const mockPush = jest.fn()
const mockCanDo = jest.fn()
let mockRoles: string[] = []
let mockPermisos: { module: string; canRead: boolean }[] = []

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/drawer', () => ({ useDrawerStatus: () => 'closed' }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}))
jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))
jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({ canDo: mockCanDo }),
}))
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ refreshPermissions: jest.fn(), logout: jest.fn() }),
}))
jest.mock('@/libs/store/auth.store', () => ({
  useAuthStore: () => ({ isAuthenticated: true, user: { nombre: 'Emanuel', apellido: 'Parraquini', roles: mockRoles, permissions: mockPermisos } }),
}))

const props = (ruta = 'index') => ({ state: { routeNames: [ruta], index: 0 } }) as any

/** canDo que solo concede los pares módulo:acción listados. */
const conPermisos = (...pares: string[]) => mockCanDo.mockImplementation((m: string, a: string) => pares.includes(`${m}:${a}`))

const comoAdmin = () => {
  mockCanDo.mockImplementation(() => true)
  mockRoles = ['Administrador', 'AdministradorSistemas', 'Gerencia', 'Empleado']
}

const FUERA_DE_ALCANCE = ['Usuarios', 'Depósitos', 'Proveedores', 'Cargas masivas', 'Viajes', 'Vehículos', 'Picking', 'Perfiles', 'Roles']

// Sin pantalla todavía: no se ofrecen enlaces a pantallas que no existen.
const SIN_PANTALLA: string[] = []

const APROBADOS = [
  'Inicio',
  'Ventas',
  'Compras',
  'Clientes',
  'Catálogo y stock',
  'Cuentas corrientes',
  'Transferencias y cheques',
  'Calendario',
  'Reportes',
  'Consola del chofer',
  'Pedidos por preparar',
  'Mi cuenta y contraseña',
]

const RUTAS_FUERA_DE_ALCANCE = ['/usuarios', '/inventario/depositos', '/inventario/nuevo', '/logistica/viajes', '/logistica/vehiculos', '/logistica/picking']

describe('CustomDrawerContent — recorte al alcance aprobado', () => {
  beforeEach(() => {
    mockPush.mockClear()
    comoAdmin()
  })

  it('no ofrece ningún módulo fuera de alcance ni sin pantalla, ni siquiera a un administrador', () => {
    render(<CustomDrawerContent {...props()} />)

    for (const nombre of [...FUERA_DE_ALCANCE, ...SIN_PANTALLA]) {
      expect(screen.queryByText(new RegExp(nombre, 'i'))).toBeNull()
    }
  })

  it('ofrece los módulos aprobados, con Tesorería y Logística agrupadas', () => {
    render(<CustomDrawerContent {...props()} />)

    for (const nombre of [...APROBADOS, 'Tesorería', 'Logística']) {
      expect(screen.getByText(nombre)).toBeTruthy()
    }
  })

  it('ninguna entrada del menú navega a una ruta fuera de alcance', async () => {
    const user = userEvent.setup()
    render(<CustomDrawerContent {...props()} />)

    for (const nombre of APROBADOS) {
      await user.press(screen.getByRole('button', { name: nombre }))
    }

    const rutas = mockPush.mock.calls.map(([ruta]) => String(ruta))
    expect(rutas).toHaveLength(APROBADOS.length)
    for (const fuera of RUTAS_FUERA_DE_ALCANCE) {
      expect(rutas.some((r) => r.includes(fuera))).toBe(false)
    }
  })

  it('marca la entrada de la pantalla actual, también en sus pantallas hijas', () => {
    render(<CustomDrawerContent {...props('ventas/nueva')} />)

    expect(screen.getByRole('button', { name: 'Ventas' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByRole('button', { name: 'Inicio' }).props.accessibilityState).toMatchObject({ selected: false })
  })
})

describe('CustomDrawerContent — filtrado por permisos (usuario sin rol de administrador)', () => {
  beforeEach(() => {
    mockRoles = ['Empleado']
    mockPermisos = []
  })

  const visibles = () => APROBADOS.filter((n) => screen.queryByText(n) !== null)

  it('un vendedor ve ventas, clientes, catálogo y su cuenta corriente; no compras, cobros ni logística', () => {
    conPermisos('MOD_VENTAS:read', 'MOD_VENTAS:create', 'MOD_CLIENTES:read', 'MOD_STOCK:read', 'MOD_CC:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Ventas', 'Clientes', 'Catálogo y stock', 'Cuentas corrientes', 'Calendario', 'Reportes', 'Mi cuenta y contraseña'])
    expect(screen.getByText('Tesorería')).toBeTruthy()
    // Un grupo sin entradas visibles no deja su título colgado.
    expect(screen.queryByText('Logística')).toBeNull()
  })

  it('un vendedor de solo lectura ve el módulo de ventas', () => {
    conPermisos('MOD_VENTAS:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Ventas', 'Calendario', 'Reportes', 'Mi cuenta y contraseña'])
  })

  it('un chofer (lee ventas pero no las crea) ve su consola y no el módulo de ventas', () => {
    conPermisos('MOD_VENTAS:read', 'MOD_VIAJES:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Calendario', 'Consola del chofer', 'Mi cuenta y contraseña'])
    expect(screen.queryByText('Tesorería')).toBeNull()
  })

  it('sin ningún permiso quedan Inicio, Calendario (el servidor no lo gatea por módulo) y Mi cuenta', () => {
    conPermisos()
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Calendario', 'Mi cuenta y contraseña'])
    expect(screen.queryByText('Tesorería')).toBeNull()
    expect(screen.queryByText('Logística')).toBeNull()
  })

  it('Autorizaciones aparece solo con la capacidad de autorizar ventas, aunque lea ventas', async () => {
    conPermisos('MOD_VENTAS:read', 'MOD_VENTAS:create')
    const { unmount } = render(<CustomDrawerContent {...props()} />)
    expect(screen.queryByText('Autorizaciones')).toBeNull()
    unmount()

    mockPermisos = [{ module: 'CAP_AUTORIZAR_VENTA', canRead: true }]
    render(<CustomDrawerContent {...props()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Autorizaciones' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/autorizaciones')
  })
})
