import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'

const mockSetItem = jest.fn().mockResolvedValue(undefined)
const mockGetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...a: unknown[]) => mockSetItem(...a),
  getItemAsync: (...a: unknown[]) => mockGetItem(...a),
}))
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
jest.mock('../../libs/store/auth.store', () => ({
  useAuthStore: () => ({ user: { username: 'ana', roles: ['Vendedor'] }, logout: jest.fn() }),
}))

import PerfilScreen from '../../app/(tabs)/perfil'

beforeEach(() => {
  mockSetItem.mockClear()
  mockGetItem.mockReset()
  useThemeStore.setState({ mode: 'system', isHydrated: false })
})

describe('selector de tema en Mi cuenta', () => {
  it('ofrece Claro, Oscuro y Como el teléfono, con el modo actual elegido', () => {
    render(<PerfilScreen />)
    expect(screen.getByLabelText('Tema')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Claro' })).not.toBeSelected()
    expect(screen.getByRole('radio', { name: 'Oscuro' })).not.toBeSelected()
    expect(screen.getByRole('radio', { name: 'Como el teléfono' })).toBeSelected()
  })

  it('elegir Oscuro cambia el modo a dark y lo persiste', async () => {
    render(<PerfilScreen />)
    await userEvent.press(screen.getByRole('radio', { name: 'Oscuro' }))
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(mockSetItem).toHaveBeenCalledWith('forward_theme_mode', 'dark')
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeSelected()
  })

  it('"Como el teléfono" vuelve a system y lo persiste', async () => {
    useThemeStore.setState({ mode: 'dark' })
    render(<PerfilScreen />)
    await userEvent.press(screen.getByRole('radio', { name: 'Como el teléfono' }))
    expect(useThemeStore.getState().mode).toBe('system')
    expect(mockSetItem).toHaveBeenCalledWith('forward_theme_mode', 'system')
  })

  it('es el único selector de tema: ya no hay botón de sol/luna en Mi cuenta', () => {
    render(<PerfilScreen />)
    // Un solo grupo de tema, con sus tres opciones (el otro grupo de Mi cuenta es el servidor).
    expect(screen.getAllByLabelText('Tema')).toHaveLength(1)
    expect(within(screen.getByLabelText('Tema')).getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByText('Apariencia (Tema)')).toBeNull()
    expect(screen.queryByText('Sistema')).toBeNull()
  })
})

describe('hidratación del modo guardado', () => {
  it('hydrate() lee el modo persistido y marca isHydrated', async () => {
    mockGetItem.mockResolvedValue('dark')
    await useThemeStore.getState().hydrate()
    expect(mockGetItem).toHaveBeenCalledWith('forward_theme_mode')
    expect(useThemeStore.getState()).toMatchObject({ mode: 'dark', isHydrated: true })
  })

  it('un valor guardado inválido se ignora y queda "system"', async () => {
    mockGetItem.mockResolvedValue('violeta')
    await useThemeStore.getState().hydrate()
    expect(useThemeStore.getState()).toMatchObject({ mode: 'system', isHydrated: true })
  })

  it('si SecureStore falla igual termina de hidratar', async () => {
    mockGetItem.mockRejectedValue(new Error('x'))
    await useThemeStore.getState().hydrate()
    await waitFor(() => expect(useThemeStore.getState().isHydrated).toBe(true))
    expect(useThemeStore.getState().mode).toBe('system')
  })
})

describe('persistencia del modo', () => {
  it('si setItemAsync falla, setMode no rechaza y el modo elegido queda en la sesión', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('disco lleno'))
    await expect(useThemeStore.getState().setMode('dark')).resolves.toBeUndefined()
    expect(useThemeStore.getState().mode).toBe('dark')
  })
})
