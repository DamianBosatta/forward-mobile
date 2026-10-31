import React from 'react'
import { render, screen } from '@testing-library/react-native'

jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn(), info: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, isError: false, isSuccess: false }),
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}))
jest.mock('@/core/ui', () => ({ ForwardLogo: () => null, ConfirmModal: () => null }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn() } }))
jest.mock('@/libs/api-client', () => ({ API_URL: 'x', setApiUrl: jest.fn(), ENV_PROD: 'p', ENV_DEV: 'd', ENV_LOCAL: 'l' }))
jest.mock('../../../../libs/store/auth.store', () => ({
  useAuthStore: () => ({
    user: { nombre: 'Super', apellido: 'Admin', username: 'superadmin@forward.com', email: 'superadmin@forward.com', roles: ['AdministradorSistemas'] },
    logout: jest.fn(),
    canDo: () => false,
  }),
}))

import PerfilScreen from '../../../../app/(tabs)/perfil'

describe('Mi cuenta: encabezado y servidor', () => {
  it('el email aparece una sola vez y el rol va solo en su línea', () => {
    render(<PerfilScreen />)
    expect(screen.getAllByText(/superadmin@forward\.com/)).toHaveLength(1)
    expect(screen.getByText('AdministradorSistemas')).toBeTruthy()
  })

  it('el bloque Servidor se muestra solo en desarrollo', () => {
    render(<PerfilScreen />)
    expect(screen.getByLabelText('Servidor')).toBeTruthy()
  })

  it('en una build que no es de desarrollo no hay bloque Servidor', () => {
    const previo = (globalThis as { __DEV__?: boolean }).__DEV__
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    try {
      render(<PerfilScreen />)
      expect(screen.queryByLabelText('Servidor')).toBeNull()
      expect(screen.queryByText(/Servidor \(solo en desarrollo\)/)).toBeNull()
    } finally {
      ;(globalThis as { __DEV__?: boolean }).__DEV__ = previo
    }
  })

  it('Cerrar sesión va justo después de la versión, antes del bloque de servidor', () => {
    render(<PerfilScreen />)
    const textos = screen.toJSON() as unknown
    const plano = JSON.stringify(textos)
    expect(plano.indexOf('Cerrar sesión')).toBeLessThan(plano.indexOf('Servidor (solo en desarrollo)'))
  })
})
