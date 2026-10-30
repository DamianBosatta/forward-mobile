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
const mockBajaPush = jest.fn()
jest.mock('@/features/notificaciones', () => ({
  ...jest.requireActual('@/features/notificaciones'),
  darDeBajaPushAntesDeSalir: () => mockBajaPush(),
}))
const mockReplace = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.4.0' } } }))
const mockHuella = { disponible: true, prendida: true }
const mockSetHuella = jest.fn()
jest.mock('@/features/auth/utils/biometrics', () => ({
  isBiometricsAvailable: async () => mockHuella.disponible,
  isBiometricLoginEnabled: async () => mockHuella.prendida,
  setBiometricLoginEnabled: (v: boolean) => mockSetHuella(v),
}))
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
  mockBajaPush.mockResolvedValue(undefined)
  mockSetHuella.mockResolvedValue(undefined)
  mockHuella.disponible = true
  mockHuella.prendida = true
  ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
})

describe('Mi cuenta reducida (bloque 12, T2: R15 y reglas mobile §14)', () => {
  it('la cabecera muestra el nombre, el rol y el usuario', () => {
    usuario()
    pintar()
    expect(screen.getByText('Emanuel Parraquini')).toBeTruthy()
    expect(screen.getByText('Vendedor · eparraquini')).toBeTruthy()
  })

  it('apagar "Entrar con huella" lo guarda y borra la contraseña del teléfono', async () => {
    usuario()
    pintar()
    const huella = await screen.findByRole('switch', { name: 'Entrar con huella' })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Entrar con huella' }).props.accessibilityState.checked).toBe(true))
    await userEvent.press(huella)
    expect(mockSetHuella).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Entrar con huella' }).props.accessibilityState.checked).toBe(false))
  })

  it('prenderla avisa que vale desde el próximo ingreso con contraseña', async () => {
    mockHuella.prendida = false
    usuario()
    pintar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Entrar con huella' }).props.accessibilityState.checked).toBe(false))
    await userEvent.press(screen.getByRole('switch', { name: 'Entrar con huella' }))
    expect(mockSetHuella).toHaveBeenCalledWith(true)
    expect(await screen.findByText('La próxima vez que entres con tu contraseña queda lista la huella.')).toBeTruthy()
  })

  it('sin huella en el teléfono no ofrece el interruptor', async () => {
    mockHuella.disponible = false
    usuario()
    pintar()
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Entrar con huella' })).toBeNull())
  })

  it('"Avisos en el teléfono" lleva a las preferencias de avisos', async () => {
    usuario()
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Avisos en el teléfono' }))
    expect(mockPush).toHaveBeenCalledWith('/avisos/preferencias')
  })

  it('no muestra las sesiones abiertas (quedan en la web)', () => {
    usuario()
    pintar()
    expect(screen.queryByText(/Sesiones abiertas/i)).toBeNull()
    expect(mockGet).not.toHaveBeenCalledWith('/api/v1/Sessions')
  })

  it('dice la versión y a qué servidor está conectada', () => {
    usuario()
    pintar()
    expect(screen.getByText('Forward Mobile 1.4.0 · conectado a producción')).toBeTruthy()
  })

  it('en las builds que van a los teléfonos no hay selector de servidor', () => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    usuario()
    pintar()
    expect(screen.queryByLabelText('Servidor')).toBeNull()
  })
})

describe('Mi cuenta', () => {
  it('muestra los datos del usuario, conserva el tema y siempre hay forma de salir de la pantalla', () => {
    usuario()
    pintar()
    expect(screen.getByText('Emanuel Parraquini')).toBeTruthy()
    expect(screen.getByLabelText('Tema')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy()
  })

  it('no muestra el puesto, aunque llegara (decisión del dueño del 16-10: "Sacarlo de la pantalla")', () => {
    usuario({ puesto: 'Depósito' })
    pintar()
    expect(screen.queryByText(/Puesto|Depósito/)).toBeNull()
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
    // El botón apagado dice por qué, en una línea (lámina perfil--clave).
    expect(screen.getByText('Se habilita cuando todo está completo y las dos nuevas coinciden.')).toBeTruthy()

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

  it('cerrar sesión da de baja el celular para push antes de revocar la sesión en el servidor', async () => {
    usuario()
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cerrar sesión'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockBajaPush).toHaveBeenCalledTimes(1)
    expect(mockBajaPush.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[0])
  })

  it('cambiar de servidor también da de baja el push antes de revocar la sesión', async () => {
    usuario()
    pintar()
    await userEvent.press(screen.getByRole('radio', { name: 'Local' }))
    await userEvent.press(screen.getByLabelText('Confirmar: Cambiar y salir'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockBajaPush.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[0])
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
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
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
