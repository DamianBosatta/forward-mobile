/**
 * Barra inferior de accesos rápidos (lámina CalleMiDia, D2): Mi día, Ventas, Clientes y Cobros.
 * Solo en teléfono; en tablet el menú está fijo y la barra no aparece. Cada acceso pide el mismo
 * permiso que su entrada del menú lateral.
 */
import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { ConAccesosRapidos } from '../AccesosRapidos'

const mockPush = jest.fn()
const mockDispatch = jest.fn()
const mockCanDo = jest.fn()
const mockDims = jest.fn()

jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  DrawerActions: { openDrawer: () => ({ type: 'OPEN_DRAWER' }) },
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }))
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: mockCanDo }) }))

const conAncho = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })
const conPermisos = (...pares: string[]) => mockCanDo.mockImplementation((m: string, a: string) => pares.includes(`${m}:${a}`))
const VENDEDOR = ['MOD_VENTAS:read', 'MOD_VENTAS:create', 'MOD_CLIENTES:read', 'MOD_CC:read', 'MOD_COMPRAS:read']

const pantalla = (activa: 'inicio' | 'ventas' | 'compras' = 'inicio') =>
  render(
    <ConAccesosRapidos activa={activa}>
      <Text>Contenido de la pantalla</Text>
    </ConAccesosRapidos>,
  )

const nombresDeLaBarra = () => screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)

describe('ConAccesosRapidos', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockDispatch.mockClear()
  })

  it('en teléfono muestra la barra del diseño: Mi día, Ventas, Clientes y Cobros, en ese orden y nada más', () => {
    conAncho(390)
    conPermisos(...VENDEDOR)
    pantalla()

    expect(screen.getByText('Contenido de la pantalla')).toBeTruthy()
    expect(nombresDeLaBarra()).toEqual(['Mi día', 'Ventas', 'Clientes', 'Cobros'])
  })

  it.each([600, 1194])('con %i px (tablet) no hay barra: el menú está fijo', (ancho) => {
    conAncho(ancho)
    conPermisos(...VENDEDOR)
    pantalla()

    expect(screen.getByText('Contenido de la pantalla')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cobros' })).toBeNull()
  })

  it('cada acceso lleva a su pantalla: Cobros abre las cuentas corrientes', async () => {
    conAncho(390)
    conPermisos(...VENDEDOR)
    const user = userEvent.setup()
    pantalla()

    await user.press(screen.getByRole('button', { name: 'Ventas' }))
    await user.press(screen.getByRole('button', { name: 'Clientes' }))
    await user.press(screen.getByRole('button', { name: 'Cobros' }))
    await user.press(screen.getByRole('button', { name: 'Mi día' }))

    expect(mockPush.mock.calls.map(([r]) => r)).toEqual(['/(tabs)/ventas', '/(tabs)/socios', '/(tabs)/cuentas', '/(tabs)/'])
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('marca la pantalla en la que está', () => {
    conAncho(390)
    conPermisos(...VENDEDOR)
    pantalla('ventas')

    expect(screen.getByRole('button', { name: 'Ventas' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByRole('button', { name: 'Mi día' }).props.accessibilityState).toMatchObject({ selected: false })
  })

  it('en Compras no hay acceso marcado ni "+": la lista de compras trae el suyo', () => {
    conAncho(390)
    conPermisos(...VENDEDOR, 'MOD_COMPRAS:create')
    pantalla('compras')

    expect(nombresDeLaBarra()).toEqual(['Mi día', 'Ventas', 'Clientes', 'Cobros'])
    for (const b of screen.getAllByRole('button')) expect(b.props.accessibilityState).toMatchObject({ selected: false })
  })

  it('un chofer (lee ventas, no las crea) ve solo Mi día', () => {
    conAncho(390)
    conPermisos('MOD_VENTAS:read', 'MOD_VIAJES:read')
    pantalla()

    expect(nombresDeLaBarra()).toEqual(['Mi día'])
  })

  it('sin permisos queda solo Mi día', () => {
    conAncho(390)
    conPermisos()
    pantalla()

    expect(nombresDeLaBarra()).toEqual(['Mi día'])
  })

  // S8 (T1): como la web (sidebar.tsx, entrada "Ventas / Presupuestos" con MOD_VENTAS:create), leer no alcanza.
  it('con Ventas o Pedidos solo en lectura no aparece Ventas: la web pide crear ventas', () => {
    conAncho(390)
    conPermisos('MOD_PEDIDOS:read')
    const { unmount } = pantalla()
    expect(nombresDeLaBarra()).toEqual(['Mi día'])
    unmount()

    conPermisos('MOD_VENTAS:read')
    pantalla()
    expect(nombresDeLaBarra()).toEqual(['Mi día'])
  })

  it('con crear ventas aparece Ventas', () => {
    conAncho(390)
    conPermisos('MOD_VENTAS:create')
    pantalla()

    expect(nombresDeLaBarra()).toEqual(['Mi día', 'Ventas'])
  })

  it('Clientes pide MOD_CLIENTES y Cobros pide MOD_CC, como el menú lateral', () => {
    conAncho(390)
    conPermisos('MOD_CLIENTES:read')
    const { unmount } = pantalla()
    expect(nombresDeLaBarra()).toEqual(['Mi día', 'Clientes'])
    unmount()

    conPermisos('MOD_CC:read')
    pantalla()
    expect(nombresDeLaBarra()).toEqual(['Mi día', 'Cobros'])
  })
})
