/**
 * Bloque 9A (PR 0.2b) — menú lateral según el ancho (plan §8): en teléfono se
 * abre con el botón (cajón que entra encima); en tablet (≥ 600) queda fijo a
 * la izquierda con el ancho de la lámina TabInicio.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import DrawerLayout from '@/app/(tabs)/_layout'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))

const mockDrawer = jest.fn()
jest.mock('expo-router/drawer', () => {
  const Drawer = (props: any) => {
    mockDrawer(props)
    return null
  }
  Drawer.Screen = () => null
  return { Drawer }
})
jest.mock('@/src/components/layout/CustomDrawerContent', () => () => null)

const opcionesConAncho = (width: number) => {
  mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })
  mockDrawer.mockClear()
  render(<DrawerLayout />)
  return mockDrawer.mock.calls[0][0].screenOptions
}

describe('DrawerLayout — menú lateral por ancho', () => {
  it.each([360, 599])('con %i px el menú no está fijo: se abre con el botón', (ancho) => {
    const opciones = opcionesConAncho(ancho)
    expect(opciones.drawerType).not.toBe('permanent')
    expect(opciones.drawerStyle.width).toBe('80%')
  })

  it.each([600, 834, 1194])('con %i px el menú queda fijo a la izquierda, de 240 px', (ancho) => {
    const opciones = opcionesConAncho(ancho)
    expect(opciones.drawerType).toBe('permanent')
    expect(opciones.drawerStyle.width).toBe(240)
  })
})
