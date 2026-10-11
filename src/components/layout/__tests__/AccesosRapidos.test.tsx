/**
 * Bloque 9A (PR 0.3) — barra inferior de accesos rápidos (lámina Main):
 * Inicio, Ventas, "+" (nueva venta), Compras y Menú. Solo en teléfono; en
 * tablet el menú está fijo y la barra no aparece. Respeta los permisos.
 */
import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { ConAccesosRapidos } from '../AccesosRapidos'

const mockPush = jest.fn()
const mockDispatch = jest.fn()
const mockCanDo = jest.fn()
const mockDims = jest.fn()

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
const VENDEDOR_Y_COMPRADOR = ['MOD_VENTAS:read', 'MOD_VENTAS:create', 'MOD_COMPRAS:read']

const pantalla = (activa: 'inicio' | 'ventas' | 'compras' = 'inicio') =>
  render(
    <ConAccesosRapidos activa={activa}>
      <Text>Contenido de la pantalla</Text>
    </ConAccesosRapidos>,
  )

describe('ConAccesosRapidos', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockDispatch.mockClear()
  })

  it('en teléfono muestra la barra con Inicio, Ventas, Nueva venta, Compras y Menú', () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR)
    pantalla()

    expect(screen.getByText('Contenido de la pantalla')).toBeTruthy()
    for (const nombre of ['Inicio', 'Ventas', 'Nueva venta', 'Compras', 'Menú']) {
      expect(screen.getByRole('button', { name: nombre })).toBeTruthy()
    }
  })

  it.each([600, 1194])('con %i px (tablet) no hay barra: el menú está fijo', (ancho) => {
    conAncho(ancho)
    conPermisos(...VENDEDOR_Y_COMPRADOR)
    pantalla()

    expect(screen.getByText('Contenido de la pantalla')).toBeTruthy()
    expect(screen.queryByLabelText('Acciones rápidas')).toBeNull()
  })

  it('cada acceso lleva a su pantalla y Menú abre el menú lateral', async () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR)
    const user = userEvent.setup()
    pantalla()

    await user.press(screen.getByRole('button', { name: 'Ventas' }))
    await user.press(screen.getByRole('button', { name: 'Nueva venta' }))
    await user.press(screen.getByRole('button', { name: 'Compras' }))
    await user.press(screen.getByRole('button', { name: 'Inicio' }))
    await user.press(screen.getByRole('button', { name: 'Menú' }))

    expect(mockPush.mock.calls.map(([r]) => r)).toEqual(['/(tabs)/ventas', '/(tabs)/ventas/nueva', '/(tabs)/compras', '/(tabs)/'])
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'OPEN_DRAWER' })
  })

  it('marca la pantalla en la que está', () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR)
    pantalla('compras')

    expect(screen.getByRole('button', { name: 'Compras' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByRole('button', { name: 'Ventas' }).props.accessibilityState).toMatchObject({ selected: false })
  })

  it('sin permiso para crear ventas ni ver compras quedan solo Inicio y Menú', () => {
    conAncho(390)
    conPermisos('MOD_VENTAS:read', 'MOD_VIAJES:read') // chofer
    pantalla()

    expect(screen.getByRole('button', { name: 'Inicio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Menú' })).toBeTruthy()
    for (const nombre of ['Ventas', 'Nueva venta', 'Compras']) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
  })

  it('un vendedor de solo lectura ve Ventas en la barra, pero no el "+"', () => {
    conAncho(390)
    conPermisos('MOD_VENTAS:read')
    pantalla()

    expect(screen.getByRole('button', { name: 'Ventas' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
  })

  it('con solo lectura de pedidos también ve Ventas, como la pantalla', () => {
    conAncho(390)
    conPermisos('MOD_PEDIDOS:read')
    pantalla()

    expect(screen.getByRole('button', { name: 'Ventas' })).toBeTruthy()
  })

  it('en Compras el "+" es uno solo y crea una compra', async () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR, 'MOD_COMPRAS:create')
    const user = userEvent.setup()
    pantalla('compras')

    expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
    await user.press(screen.getByRole('button', { name: 'Nueva compra' }))
    expect(mockPush.mock.calls.map(([r]) => r)).toEqual(['/(tabs)/compras/nueva'])
  })

  it('en Compras sin permiso para crear compras no hay "+"', () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR)
    pantalla('compras')

    expect(screen.queryByRole('button', { name: 'Nueva compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
  })

  it('en Ventas el "+" sigue creando una venta', async () => {
    conAncho(390)
    conPermisos(...VENDEDOR_Y_COMPRADOR, 'MOD_COMPRAS:create')
    const user = userEvent.setup()
    pantalla('ventas')

    expect(screen.queryByRole('button', { name: 'Nueva compra' })).toBeNull()
    await user.press(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(mockPush.mock.calls.map(([r]) => r)).toEqual(['/(tabs)/ventas/nueva'])
  })
})
