/**
 * Pantalla sin permiso (bloque 12, T13b, lienzo R16): nombra la sección, dice a quién pedir el
 * acceso y deja volver al inicio. Con el permiso, muestra la pantalla.
 */
import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { RequirePermission } from '../RequirePermission'
import { conPermisos } from '@/features/clientes/__testing__/ayuda'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }))

beforeEach(() => jest.clearAllMocks())

describe('RequirePermission en modo pantalla', () => {
  it('con el permiso muestra la pantalla', () => {
    conPermisos([{ module: 'MOD_COMPRAS', canRead: true }])
    render(<RequirePermission module="MOD_COMPRAS" action="read" mode="screen" seccion="Compras"><Text>Lista de compras</Text></RequirePermission>)
    expect(screen.getByText('Lista de compras')).toBeTruthy()
  })

  it('sin el permiso nombra la sección, dice a quién pedirlo y vuelve al inicio', async () => {
    conPermisos([])
    render(<RequirePermission module="MOD_COMPRAS" action="read" mode="screen" seccion="Compras"><Text>Lista de compras</Text></RequirePermission>)
    expect(screen.queryByText('Lista de compras')).toBeNull()
    expect(screen.getByRole('header', { name: 'No tenés acceso a Compras' })).toBeTruthy()
    expect(screen.getByText('Si lo necesitás, pedíselo a quien administra los usuarios en la web.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })

  it('sin nombre de sección dice "esta sección"', () => {
    conPermisos([])
    render(<RequirePermission module="MOD_COMPRAS" action="read" mode="screen"><Text>Lista de compras</Text></RequirePermission>)
    expect(screen.getByRole('header', { name: 'No tenés acceso a esta sección' })).toBeTruthy()
  })

  it('en modo ocultar no muestra nada sin el permiso (sin cambios)', () => {
    conPermisos([])
    render(<RequirePermission module="MOD_COMPRAS" action="create"><Text>Nueva compra</Text></RequirePermission>)
    expect(screen.queryByText('Nueva compra')).toBeNull()
    expect(screen.queryByText(/No tenés acceso/)).toBeNull()
  })
})
