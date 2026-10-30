/**
 * Mobile redesign, stage 4 (lámina perfil--clave): cambiar la contraseña es su propia ruta, a la que
 * se llega desde Mi cuenta. La llamada y las reglas son las de siempre (el servidor valida).
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import ClaveRoute from '../../../../app/(tabs)/perfil/clave'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { post: (u: string, b: unknown) => mockPost(u, b), get: jest.fn() } }))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

function pintar() {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', username: 'ep', email: 'ep@forward.com.ar', roles: [], permissions: [] } } as never)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ClaveRoute /></QueryClientProvider>)
}
async function completar(actual: string, nueva: string, repetida: string) {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), nueva)
  await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), repetida)
}
const botonCambiar = () => screen.getByRole('button', { name: 'Cambiar contraseña' })

beforeEach(() => { jest.clearAllMocks(); mockPost.mockResolvedValue(true) })

describe('Cambiar contraseña (ruta propia)', () => {
  it('tiene su barra con título y vuelta a Mi cuenta', async () => {
    pintar()
    // Título de la barra + botón del formulario; el encabezado interno del formulario ya no está.
    expect(screen.getAllByText('Cambiar contraseña')).toHaveLength(2)
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('cambia la contraseña con el correo del usuario y limpia el formulario', async () => {
    pintar()
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)
    await completar('Vieja#2025', 'Nueva#20260', 'Nueva#20260')
    await userEvent.press(botonCambiar())
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Users/change-password', {
      email: 'ep@forward.com.ar', currentPassword: 'Vieja#2025', newPassword: 'Nueva#20260', confirmNewPassword: 'Nueva#20260',
    })
    expect(await screen.findByText(/la contraseña nueva ya vale/)).toBeTruthy()
    expect(screen.getByLabelText('Contraseña actual').props.value).toBe('')
  })

  it('si no coinciden no deja enviar; los errores del servidor se muestran tal cual', async () => {
    pintar()
    await completar('Vieja#2025', 'corta', 'otra')
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy()
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Se habilita cuando todo está completo y las dos nuevas coinciden.')).toBeTruthy()
    await userEvent.clear(screen.getByLabelText('Repetir la contraseña nueva'))
    await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), 'corta')
    mockPost.mockRejectedValueOnce(new Error('Passwords must be at least 10 characters.'))
    await userEvent.press(botonCambiar())
    expect(await screen.findByText('Passwords must be at least 10 characters.')).toBeTruthy()
  })
})
