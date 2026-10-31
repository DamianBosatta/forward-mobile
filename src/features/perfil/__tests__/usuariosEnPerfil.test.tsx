/** Perfil: el total de usuarios en la fila "Usuarios" solo con MOD_USUARIOS:Read. */
import React from 'react'
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

describe('Perfil: cantidad de usuarios (MOD_USUARIOS:Read)', () => {
  it('con permiso la fila suma el total que da el servidor', async () => {
    usuario({ permissions: [{ module: 'MOD_USUARIOS', canRead: true }] })
    mockGet.mockImplementation(async (url: string) => (url.startsWith('/api/v1/Users?') ? { items: [{ id: 'x' }], totalCount: 12, page: 1, pageSize: 1, totalPages: 12, hasNextPage: true } : []))
    pintar()

    expect(await screen.findByText('Solo consulta · 12 usuarios')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Users?pageNumber=1&pageSize=1')
  })

  it('1 usuario va en singular', async () => {
    usuario({ permissions: [{ module: 'MOD_USUARIOS', canRead: true }] })
    mockGet.mockImplementation(async () => ({ items: [{ id: 'x' }], totalCount: 1, page: 1, pageSize: 1, totalPages: 1, hasNextPage: false }))
    pintar()

    expect(await screen.findByText('Solo consulta · 1 usuario')).toBeTruthy()
  })

  it('si la lista falla, queda "Solo consulta" sin número', async () => {
    usuario({ permissions: [{ module: 'MOD_USUARIOS', canRead: true }] })
    mockGet.mockRejectedValue(new Error('sin red'))
    pintar()

    expect(await screen.findByText('Solo consulta')).toBeTruthy()
    expect(screen.queryByText(/usuarios?$/)).toBeNull()
  })

  it('sin MOD_USUARIOS:Read no hay fila ni se pide la lista', () => {
    usuario({ permissions: [{ module: 'MOD_VENTAS', canRead: true }] })
    pintar()

    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('/Users'))).toBe(false)
  })
})
