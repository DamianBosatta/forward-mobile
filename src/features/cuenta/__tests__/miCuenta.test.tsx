/**
 * Bloque 9A, fase 4.6 — Mi cuenta (lámina MiCuenta). Reemplaza a "Sesiones y accesos"
 * (app/security.tsx), que mostraba estados de seguridad inventados y no tenía cómo volver.
 */
import React from 'react'
import fs from 'fs'
import path from 'path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import PerfilScreen from '../../../../app/(tabs)/perfil'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'https://api.forward-gestion.com.ar',
  ENV_PROD: 'https://api.forward-gestion.com.ar', ENV_DEV: 'https://dev', ENV_LOCAL: 'http://local',
  setApiUrl: jest.fn(),
  api: { post: (url: string, body: unknown) => mockPost(url, body) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn() } }))
jest.mock('@/core/ui', () => {
  const { Pressable, Text } = require('react-native')
  return {
    ConfirmModal: ({ visible, confirmLabel, onConfirm }: { visible: boolean; confirmLabel: string; onConfirm: () => void }) =>
      visible ? <Pressable accessibilityRole="button" accessibilityLabel={`Confirmar: ${confirmLabel}`} onPress={onConfirm}><Text>{confirmLabel}</Text></Pressable> : null,
  }
})

function usuario(extra: object = {}) {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'u1', username: 'eparraquini', email: 'ep@forward.com.ar', nombre: 'Emanuel', apellido: 'Parraquini', roles: ['Vendedor'], permissions: [], ...extra },
  } as never)
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PerfilScreen /></QueryClientProvider>)
}

async function completar(actual: string, nueva: string, repetida: string) {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), nueva)
  await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), repetida)
}

const botonCambiar = () => screen.getByRole('button', { name: 'Cambiar contraseña' })

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue(true)
})

describe('Mi cuenta', () => {
  it('muestra los datos del usuario, conserva el tema y siempre hay forma de salir de la pantalla', () => {
    usuario()
    pintar()
    expect(screen.getByText('Emanuel Parraquini')).toBeTruthy()
    expect(screen.getByLabelText('Correo: ep@forward.com.ar')).toBeTruthy()
    expect(screen.getByLabelText('Tema')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy()
  })

  it('no muestra estados de seguridad inventados y la pantalla vieja ya no existe', () => {
    usuario()
    pintar()
    expect(screen.queryByText(/MFA|Biométrica|meses|Alertas de Inicio/i)).toBeNull()
    expect(fs.existsSync(path.join(__dirname, '../../../../app/security.tsx'))).toBe(false)
  })

  it('cambia la contraseña con el correo del usuario y limpia el formulario', async () => {
    usuario()
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
    usuario()
    pintar()
    await completar('Vieja#2025', 'corta', 'otra')
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy()
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)

    await userEvent.clear(screen.getByLabelText('Repetir la contraseña nueva'))
    await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), 'corta')
    mockPost.mockRejectedValueOnce(new Error('Passwords must be at least 10 characters.'))
    await userEvent.press(botonCambiar())
    expect(await screen.findByText('Passwords must be at least 10 characters.')).toBeTruthy()
  })

  it('cerrar sesión revoca las sesiones en el servidor y sale, aunque el servidor no responda', async () => {
    usuario()
    mockPost.mockRejectedValueOnce(new Error('sin señal'))
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cerrar sesión'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Sessions/logout', {})
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
