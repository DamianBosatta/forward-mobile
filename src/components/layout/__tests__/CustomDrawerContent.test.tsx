/**
 * Bloque 9A — el menú lateral.
 *
 * PR 0.4: solo ofrece los módulos del alcance aprobado, ni siquiera a un administrador.
 * PR 0.3: los nombres siguen la lámina Menu ("Ventas", "Catálogo" y "Stock",
 * "Cuentas corrientes"...) y cada usuario ve solo lo que sus permisos le dejan usar.
 */
import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import CustomDrawerContent from '../CustomDrawerContent'
import { permisosDesde } from '@/features/auth/lib/permisos'

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
const mockCerrarSesion = jest.fn()
jest.mock('@/features/cuenta/hooks/useCerrarSesion', () => ({ useCerrarSesion: () => ({ cerrarSesion: mockCerrarSesion }) }))
let mockNoLeidos = 0
jest.mock('@/features/notificaciones', () => ({ useAvisosNoLeidos: () => mockNoLeidos }))
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

const SECCIONES = ['VENDER', 'COMPRAR', 'GESTIÓN', 'LOGÍSTICA']

const FUERA_DE_ALCANCE = ['Usuarios', 'Depósitos', 'Cargas masivas', 'Viajes', 'Vehículos', 'Picking', 'Perfiles', 'Roles']

// Sin pantalla todavía: no se ofrecen enlaces a pantallas que no existen.
const SIN_PANTALLA: string[] = []

const APROBADOS = [
  'Inicio',
  'Ventas',
  'Compras',
  'Proveedores',
  'Clientes',
  'Catálogo',
  'Stock',
  'Cuentas corrientes',
  'Transferencias',
  'Calendario',
  'Avisos',
  'Reportes',
  'Consola del chofer',
  'Pedidos de logística',
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

  it('ofrece los módulos aprobados, en las secciones del diseño', () => {
    render(<CustomDrawerContent {...props()} />)

    for (const nombre of [...APROBADOS, ...SECCIONES]) {
      expect(screen.getByText(nombre)).toBeTruthy()
    }
    expect(screen.queryByText('Tesorería')).toBeNull()
  })

  it('las secciones salen en el orden del diseño y cada entrada cae en la suya', () => {
    render(<CustomDrawerContent {...props()} />)

    const titulos = screen.getAllByRole('header').map((h) => h.props.children)
    expect(titulos).toEqual(SECCIONES)
    const texto = JSON.stringify(screen.toJSON())
    const posicion = (t: string) => texto.indexOf(JSON.stringify(t))
    const orden = ['Inicio', 'VENDER', 'Ventas', 'Clientes', 'Catálogo', 'Stock', 'COMPRAR', 'Compras', 'Proveedores', 'GESTIÓN', 'Cuentas corrientes', 'Calendario', 'LOGÍSTICA', 'Pedidos de logística', 'Consola del chofer', 'Reportes']
    const posiciones = orden.map(posicion)
    expect(orden.filter((t, i) => posiciones[i] < 0)).toEqual([])
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
  })

  it('"Cerrar sesión" va al pie y cierra la sesión con la función de siempre', async () => {
    mockCerrarSesion.mockClear()
    render(<CustomDrawerContent {...props()} />)

    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(mockCerrarSesion).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
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

  it('Avisos muestra cuántos quedan sin leer y lleva a la bandeja', async () => {
    mockNoLeidos = 3
    render(<CustomDrawerContent {...props()} />)
    const avisos = screen.getByRole('button', { name: 'Avisos, 3 sin leer' })
    expect(screen.getByText('3')).toBeTruthy()
    await userEvent.press(avisos)
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/avisos')
    mockNoLeidos = 120
    screen.rerender(<CustomDrawerContent {...props()} />)
    expect(screen.getByText('99+')).toBeTruthy()
    mockNoLeidos = 0
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

    expect(visibles()).toEqual(['Inicio', 'Ventas', 'Clientes', 'Catálogo', 'Stock', 'Cuentas corrientes', 'Calendario', 'Avisos', 'Reportes', 'Mi cuenta y contraseña'])
    expect(screen.getByText('VENDER')).toBeTruthy()
    expect(screen.getByText('GESTIÓN')).toBeTruthy()
    // Un grupo sin entradas visibles no deja su título colgado.
    expect(screen.queryByText('COMPRAR')).toBeNull()
    expect(screen.queryByText('LOGÍSTICA')).toBeNull()
  })

  it('Proveedores sale con MOD_PROVEEDORES:read, junto a Compras, y no depende de Clientes ni de Compras', async () => {
    conPermisos('MOD_PROVEEDORES:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Proveedores', 'Calendario', 'Avisos', 'Mi cuenta y contraseña'])
    await userEvent.press(screen.getByRole('button', { name: 'Proveedores' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/proveedores')
  })

  it('con Clientes y Compras pero sin MOD_PROVEEDORES no aparece Proveedores', () => {
    conPermisos('MOD_CLIENTES:read', 'MOD_COMPRAS:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Compras', 'Clientes', 'Calendario', 'Avisos', 'Mi cuenta y contraseña'])
  })

  it('un vendedor de solo lectura ve el módulo de ventas', () => {
    conPermisos('MOD_VENTAS:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Ventas', 'Calendario', 'Avisos', 'Reportes', 'Mi cuenta y contraseña'])
  })

  it('un chofer (lee ventas pero no las crea) ve su consola y no el módulo de ventas', () => {
    conPermisos('MOD_VENTAS:read', 'MOD_VIAJES:read')
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Calendario', 'Avisos', 'Consola del chofer', 'Pedidos de logística', 'Mi cuenta y contraseña'])
    expect(screen.queryByText('VENDER')).toBeNull()
  })

  it('sin ningún permiso quedan Inicio, Calendario y Avisos (el servidor no los gatea por módulo) y Mi cuenta', () => {
    conPermisos()
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Calendario', 'Avisos', 'Mi cuenta y contraseña'])
    expect(screen.queryByText('VENDER')).toBeNull()
    expect(screen.queryByText('COMPRAR')).toBeNull()
    expect(screen.queryByText('LOGÍSTICA')).toBeNull()
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

/**
 * C-004, lote L-12: el menú sale de las filas que manda el backend para cada puesto sembrado
 * (PuestoSeeder) y de las capacidades que implica su clave (AppCapabilities.CapacidadesQueImplicaElPuesto),
 * nunca del rol del usuario.
 */
describe('CustomDrawerContent — por puesto sembrado (C-004, L-12)', () => {
  type Fila = { module: string; canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }

  /** Una fila del perfil: `rcud` con las iniciales de las acciones otorgadas. */
  const fila = (module: string, rcud = 'R'): Fila => ({
    module,
    canRead: rcud.includes('R'),
    canCreate: rcud.includes('C'),
    canUpdate: rcud.includes('U'),
    canDelete: rcud.includes('D'),
  })

  const conFilas = (filas: Fila[]) => {
    mockPermisos = filas
    const { puede } = permisosDesde(filas)
    mockCanDo.mockImplementation((m: string, a: 'read' | 'create' | 'update' | 'delete') => puede(m as never, a))
  }

  const PUESTOS: Record<string, Fila[]> = {
    Vendedor: [fila('MOD_VENTAS', 'RCUD'), fila('MOD_CLIENTES', 'RC')],
    Depósito: [fila('MOD_VIAJES', 'RU'), fila('MOD_STOCK', 'RCU'), fila('MOD_PEDIDOS', 'RU'), fila('CAP_OPERAR_DEPOSITO')],
    Chofer: [fila('MOD_VIAJES', 'RU')],
    'Gerente de depósito': [
      fila('MOD_VIAJES', 'RU'),
      fila('MOD_STOCK', 'RCU'),
      fila('MOD_PEDIDOS', 'RU'),
      fila('CAP_OPERAR_DEPOSITO'),
      fila('CAP_VER_STOCK_OTROS_DEPOSITOS'),
      fila('CAP_PEDIR_TRANSFERENCIAS'),
    ],
  }

  const ESPERADO: Record<string, string[]> = {
    Vendedor: ['Inicio', 'Ventas', 'Clientes', 'Calendario', 'Avisos', 'Reportes', 'Mi cuenta y contraseña'],
    // Lee viajes y no crea ventas: el menú lo trata como al chofer, más el catálogo de su stock.
    Depósito: ['Inicio', 'Catálogo', 'Stock', 'Calendario', 'Avisos', 'Consola del chofer', 'Pedidos de logística', 'Mi cuenta y contraseña'],
    Chofer: ['Inicio', 'Calendario', 'Avisos', 'Consola del chofer', 'Pedidos de logística', 'Mi cuenta y contraseña'],
    'Gerente de depósito': ['Inicio', 'Catálogo', 'Stock', 'Calendario', 'Avisos', 'Consola del chofer', 'Pedidos de logística', 'Mi cuenta y contraseña'],
  }

  const visibles = () => APROBADOS.filter((n) => screen.queryByText(n) !== null)

  beforeEach(() => {
    mockRoles = ['Empleado']
  })

  it.each(Object.keys(PUESTOS))('el puesto %s ve lo que sus filas le dejan usar', (puesto) => {
    conFilas(PUESTOS[puesto])
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(ESPERADO[puesto])
  })

  it('el rol no abre nada: un Administrador sin filas ve solo lo que el servidor no gatea', () => {
    mockRoles = ['Administrador', 'AdministradorSistemas', 'Gerencia']
    conFilas([])
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(['Inicio', 'Calendario', 'Avisos', 'Mi cuenta y contraseña'])
  })

  it('AdministradorSistemas ve todo el alcance porque el backend le manda el catálogo completo como filas', () => {
    mockRoles = ['AdministradorSistemas']
    conFilas([
      ...['MOD_VENTAS', 'MOD_COMPRAS', 'MOD_PROVEEDORES', 'MOD_CLIENTES', 'MOD_STOCK', 'MOD_CC', 'MOD_PAGOS', 'MOD_VIAJES', 'MOD_PEDIDOS'].map((m) => fila(m, 'RCUD')),
      fila('CAP_AUTORIZAR_VENTA'),
    ])
    render(<CustomDrawerContent {...props()} />)

    expect(visibles()).toEqual(APROBADOS)
    expect(screen.getByText('Autorizaciones')).toBeTruthy()
  })
})
