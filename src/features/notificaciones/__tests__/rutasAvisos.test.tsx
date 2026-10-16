/**
 * La bandeja y sus preferencias se registran en el cajón sin sacar ninguna de las pantallas que ya
 * estaban (las que el menú y los avisos usan para navegar).
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import DrawerLayout from '@/app/(tabs)/_layout'

const mockPantallas: string[] = []
jest.mock('expo-router/drawer', () => {
  const Drawer = ({ children }: { children: React.ReactNode }) => <>{children}</>
  Drawer.Screen = ({ name }: { name: string }) => {
    mockPantallas.push(name)
    return null
  }
  return { Drawer }
})
jest.mock('@/src/components/layout/CustomDrawerContent', () => () => null)

describe('rutas del cajón', () => {
  it('registra la bandeja y las preferencias, y conserva las pantallas de antes', () => {
    render(<DrawerLayout />)
    expect(mockPantallas).toEqual(expect.arrayContaining(['avisos/index', 'avisos/preferencias']))
    expect(mockPantallas).toEqual(expect.arrayContaining([
      'index', 'ventas/index', 'calendario/index', 'tesoreria/cheques', 'autorizaciones/index', 'compras/[id]', 'perfil',
    ]))
  })
})
