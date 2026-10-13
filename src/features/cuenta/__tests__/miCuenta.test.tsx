/**
 * Bloque 9A, fase 4.6 — Mi cuenta (lámina MiCuenta). Reemplaza a "Sesiones y accesos"
 * (app/security.tsx), que mostraba estados de seguridad inventados y no tenía cómo volver.
 */
import React from 'react'
import fs from 'fs'
import path from 'path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import PerfilScreen from '../../../../app/(tabs)/perfil'

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'https://api.forward-gestion.com.ar',
  ENV_PROD: 'https://api.forward-gestion.com.ar', ENV_LOCAL: 'http://local',
  setApiUrl: jest.fn(),
  api: {
    post: (url: string, body: unknown) => mockPost(url, body),
    get: (url: string) => mockGet(url),
    delete: (url: string) => mockDelete(url),
  },
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
  mockGet.mockReset().mockResolvedValue([])
  mockDelete.mockResolvedValue(undefined)
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

  it('si el servidor no pudo cerrar las demás sesiones, sale igual pero lo dice', async () => {
    usuario()
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockRejectedValueOnce(new Error('sin señal'))
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cerrar sesión'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(alerta).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('no se pudo cerrar en los demás dispositivos'))
  })

  it('si el servidor cerró las sesiones, no hay aviso de falla', async () => {
    usuario()
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockResolvedValueOnce(true)
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cerrar sesión'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(alerta).not.toHaveBeenCalled()
  })

  it('el texto no promete cerrar la web al instante', () => {
    usuario()
    pintar()
    expect(screen.queryByText(/la web incluida/)).toBeNull()
    expect(screen.getByText(/en la web puede seguir abierta unos minutos/)).toBeTruthy()
  })

  it('cambiar de servidor también revoca las sesiones en el servidor de origen antes de salir', async () => {
    usuario()
    mockPost.mockResolvedValueOnce(true)
    pintar()
    await userEvent.press(screen.getByRole('radio', { name: 'Local' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cambiar y salir'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Sessions/logout', {})
  })

  it('cambiar de servidor cierra la confirmación antes de esperar al servidor y un segundo toque no repite el logout', async () => {
    usuario()
    let terminar: (v: boolean) => void = () => {}
    mockPost.mockReturnValueOnce(new Promise<boolean>((r) => { terminar = r }))
    pintar()
    await userEvent.press(screen.getByRole('radio', { name: 'Local' }))
    const confirmar = screen.getByLabelText('Confirmar: Cambiar y salir')
    fireEvent.press(confirmar)
    fireEvent.press(confirmar) // segundo toque sobre la misma confirmación

    // El logout todavía no terminó y la confirmación ya no está.
    expect(screen.queryByLabelText('Confirmar: Cambiar y salir')).toBeNull()
    expect(mockPost).toHaveBeenCalledTimes(1)
    terminar(true)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('si cambiar la URL falla, avisa y libera el cerrojo: se puede volver a intentar', async () => {
    usuario()
    const setApiUrl = jest.requireMock('@/core/api/client').setApiUrl as jest.Mock
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockResolvedValue(true)
    setApiUrl.mockRejectedValueOnce(new Error('disco lleno'))
    pintar()

    await userEvent.press(screen.getByRole('radio', { name: 'Local' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cambiar y salir'))
    await waitFor(() => expect(alerta).toHaveBeenCalledWith('No se pudo cambiar de servidor', expect.stringContaining('disco lleno')))
    expect(mockReplace).not.toHaveBeenCalled()

    setApiUrl.mockResolvedValueOnce(undefined)
    await userEvent.press(screen.getByRole('radio', { name: 'Local' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cambiar y salir'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    alerta.mockRestore()
  })
})

const SESIONES = [
  { id: 't1', createdAt: '2026-10-09T10:58:00Z', expiresAt: '2026-11-08T10:58:00Z', device: 'okhttp/4.12.0', ip: '181.45.12.33' },
  { id: 't 2', createdAt: '2026-10-06T21:20:00Z', expiresAt: '2026-11-05T21:20:00Z', device: 'Mozilla/5.0 (Windows NT 10.0) Chrome/129', ip: '200.68.141.7' },
]

describe('Mi cuenta: sesiones abiertas', () => {
  it('lista lo que manda el servidor, en hora argentina y sin estados inventados', async () => {
    usuario()
    mockGet.mockResolvedValue(SESIONES)
    pintar()
    expect(await screen.findByText('Sesiones abiertas (2)')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Sessions')
    expect(screen.getByText('IP 181.45.12.33')).toBeTruthy()
    expect(screen.getByText('Inició el 9 oct, 07:58 · Vence el 8 nov')).toBeTruthy()
    expect(screen.queryByText(/este dispositivo|activa ahora|última actividad/i)).toBeNull()
  })

  it('muestra cada dispositivo con un nombre legible y no el User-Agent crudo', async () => {
    usuario()
    mockGet.mockResolvedValue(SESIONES)
    pintar()
    expect(await screen.findByText('Android · App Forward')).toBeTruthy()
    expect(screen.getByText('Windows · Chrome')).toBeTruthy()
    expect(screen.queryByText('okhttp/4.12.0')).toBeNull()
    expect(screen.queryByText('Mozilla/5.0 (Windows NT 10.0) Chrome/129')).toBeNull()
    // El User-Agent crudo queda disponible para lectores de pantalla.
    expect(screen.getByLabelText('Cerrar la sesión de Android · App Forward')).toBeTruthy()
    expect(screen.getByText('Android · App Forward').props.accessibilityHint).toBe('User-Agent: okhttp/4.12.0')
  })

  it('si no reconoce el dispositivo lo dice y deja el User-Agent a la vista para identificarlo', async () => {
    usuario()
    mockGet.mockResolvedValue([
      { id: 't3', createdAt: '2026-10-09T10:58:00Z', expiresAt: '2026-11-08T10:58:00Z', device: 'curl/8.4.0', ip: '10.0.0.5' },
      { id: 't4', createdAt: null, expiresAt: null, device: '', ip: '10.0.0.6' },
    ])
    pintar()
    expect(await screen.findByText('Sesiones abiertas (2)')).toBeTruthy()
    expect(screen.getAllByText('Dispositivo desconocido')).toHaveLength(2)
    expect(screen.getByText('curl/8.4.0')).toBeTruthy()
  })

  it('cerrar una sesión la revoca en el servidor y vuelve a pedir la lista', async () => {
    usuario()
    mockGet.mockResolvedValueOnce(SESIONES).mockResolvedValueOnce([SESIONES[0]])
    pintar()
    await userEvent.press(await screen.findByLabelText('Cerrar la sesión de Windows · Chrome'))
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/Sessions/t%202')
    expect(await screen.findByText('Sesiones abiertas (1)')).toBeTruthy()
  })

  it('si no se pueden cargar, lo dice con el mensaje del servidor', async () => {
    usuario()
    mockGet.mockRejectedValue(new Error('Servicio no disponible'))
    pintar()
    expect(await screen.findByText('Servicio no disponible')).toBeTruthy()
  })
})
