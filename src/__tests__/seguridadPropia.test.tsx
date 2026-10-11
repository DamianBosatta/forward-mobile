/**
 * Bloque 9A (PR 0.4) — "Sesiones y accesos" propios: se llega desde Mi cuenta y
 * la pantalla no empuja a rutas que no existen (ABM de perfiles/usuarios fuera de alcance).
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import fs from 'fs'
import path from 'path'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  Stack: { Screen: () => null },
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: jest.fn() }) }))
jest.mock('expo-blur', () => ({ BlurView: () => null }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))
jest.mock('moti', () => ({ MotiView: () => null }))
jest.mock('@/core/ui', () => ({
  ForwardLogo: () => null,
  ConfirmModal: () => null,
  GlassCard: ({ children }: any) => <>{children}</>,
}))
jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))
jest.mock('@/libs/api-client', () => ({
  API_URL: 'x', setApiUrl: jest.fn(), ENV_PROD: 'p', ENV_DEV: 'd', ENV_LOCAL: 'l',
}))
jest.mock('@/libs/theme', () => ({
  ...jest.requireActual('@/libs/theme'),
  useColors: () => new Proxy({}, { get: () => '#000000' }),
  useThemeStore: () => ({ mode: 'light', setMode: jest.fn() }),
  tokens: {
    spacing: { sm: 4, md: 8, lg: 16, xl: 24 },
    radius: { md: 8, lg: 12, xl: 16, full: 999 },
  },
}))
jest.mock('../../libs/store/auth.store', () => ({
  useAuthStore: () => ({ user: { username: 'ana', roles: ['Vendedor'] }, logout: jest.fn() }),
}))
jest.mock('@/src/features/security/hooks/useSecurity', () => ({
  useSecurity: () => ({
    sessions: [], logs: [], isLoading: false, isError: false,
    refetch: jest.fn(), revokeSession: jest.fn(), isRevoking: false,
  }),
}))

import PerfilScreen from '../../app/(tabs)/perfil'
import SecurityCenterScreen from '../../app/security'

const rutaExiste = (ruta: string) => {
  const base = path.join(__dirname, '../../app', ruta)
  return fs.existsSync(`${base}.tsx`) || fs.existsSync(path.join(base, 'index.tsx'))
}

describe('seguridad propia (sesiones y accesos)', () => {
  beforeEach(() => mockPush.mockClear())

  it('Mi cuenta ofrece "Sesiones y accesos" y lleva a /security, que existe', () => {
    const { getByLabelText } = render(<PerfilScreen />)
    fireEvent.press(getByLabelText('Sesiones y accesos'))
    expect(mockPush).toHaveBeenCalledWith('/security')
    expect(rutaExiste('security')).toBe(true)
  })

  it('la pantalla de seguridad no ofrece ABM de perfiles ni de usuarios', () => {
    const { queryByText, UNSAFE_getAllByType } = render(<SecurityCenterScreen />)
    expect(queryByText('Perfiles de Permisos')).toBeNull()
    expect(queryByText('Asignación de Roles')).toBeNull()

    const { TouchableOpacity } = require('react-native')
    for (const t of UNSAFE_getAllByType(TouchableOpacity)) {
      if (t.props.onPress) fireEvent.press(t)
    }
    const rutas = mockPush.mock.calls.map(([r]) => String(r))
    expect(rutas.some((r) => r.includes('/security/profiles'))).toBe(false)
    expect(rutas.some((r) => r.includes('/security/users'))).toBe(false)
    for (const r of rutas) expect(rutaExiste(r.replace(/^\//, ''))).toBe(true)
  })
})
