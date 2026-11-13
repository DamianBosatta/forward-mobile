/**
 * La bandeja y sus preferencias se registran en el cajón sin sacar ninguna de las pantallas que ya
 * estaban (las que el menú y los avisos usan para navegar).
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import DrawerLayout from '@/app/(tabs)/_layout'
import { useAuthStore } from '@/libs/store/auth.store'

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

// The Drawer layout only mounts with a session.
beforeEach(() => useAuthStore.setState({ isAuthenticated: true, accessToken: 'tok' }))

describe('rutas del cajón', () => {
  it('registra la sección de avisos y conserva las secciones y pantallas de antes', () => {
    render(<DrawerLayout />)
    // Each section with inner screens is a Stack (audit A-05): the Drawer registers the section, and the
    // inbox and its preferences are screens of the "avisos" Stack.
    expect(mockPantallas).toEqual(expect.arrayContaining(['avisos']))
    expect(mockPantallas).toEqual(expect.arrayContaining([
      'index', 'ventas', 'calendario/index', 'autorizaciones', 'compras', 'perfil',
    ]))
    // El depósito de cheques salió de la app (bloque 12, D10): se hace en la web.
    expect(mockPantallas).not.toContain('tesoreria/cheques')
  })
})
