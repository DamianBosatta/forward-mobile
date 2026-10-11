import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent, act } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore, useVentaNueva } from '@/features/ventas/lib/ventaNueva'

const mockSetItem = jest.fn().mockResolvedValue(undefined)
const mockGetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...a: unknown[]) => mockSetItem(...a),
  getItemAsync: (...a: unknown[]) => mockGetItem(...a),
}))
jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn(), info: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: jest.fn() }) }))
jest.mock('@/core/ui', () => ({ ForwardLogo: () => null, ConfirmModal: () => null }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn() } }))
jest.mock('@/libs/api-client', () => ({ API_URL: 'x', setApiUrl: jest.fn(), ENV_PROD: 'p', ENV_DEV: 'd', ENV_LOCAL: 'l' }))

import PerfilScreen from '../../../../app/(tabs)/perfil'

const TOGGLE = 'Usar la venta nueva (en prueba)'

function loguear(roles: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'ana', roles: roles as never, permissions: [] },
    isAuthenticated: true,
  })
}

function Sonda() {
  return <Text testID="sonda">{useVentaNueva() ? 'nueva' : 'vieja'}</Text>
}

beforeEach(() => {
  mockSetItem.mockClear()
  mockGetItem.mockReset()
  useVentaNuevaStore.setState({ activa: false, isHydrated: false })
  useAuthStore.setState({ user: null, isAuthenticated: false })
})

describe('switch de la venta nueva', () => {
  it('arranca apagado: sin nada guardado, el administrador sigue viendo la venta de hoy', async () => {
    mockGetItem.mockResolvedValue(null)
    loguear(['Administrador'])
    await useVentaNuevaStore.getState().hydrate()
    render(<Sonda />)
    expect(screen.getByTestId('sonda')).toHaveTextContent('vieja')
    render(<PerfilScreen />)
    expect(screen.getByRole('switch', { name: TOGGLE })).not.toBeChecked()
  })

  it('el administrador lo prende en Mi cuenta → Pruebas, queda guardado y se lee al volver a abrir', async () => {
    loguear(['Administrador'])
    render(<PerfilScreen />)
    expect(screen.getByText('Pruebas')).toBeTruthy()
    await userEvent.press(screen.getByRole('switch', { name: TOGGLE }))
    expect(mockSetItem).toHaveBeenCalledWith('forward_venta_nueva', '1')
    expect(screen.getByRole('switch', { name: TOGGLE })).toBeChecked()

    // Reabrir la app: el store arranca de cero y se hidrata con lo guardado.
    useVentaNuevaStore.setState({ activa: false, isHydrated: false })
    mockGetItem.mockResolvedValue('1')
    await act(() => useVentaNuevaStore.getState().hydrate())
    render(<Sonda />)
    expect(screen.getByTestId('sonda')).toHaveTextContent('nueva')
  })

  it('un vendedor no ve el switch, y si quedó prendido en el teléfono igual ve la venta de hoy', () => {
    loguear(['Vendedor'])
    useVentaNuevaStore.setState({ activa: true, isHydrated: true })
    render(<PerfilScreen />)
    expect(screen.queryByText('Pruebas')).toBeNull()
    expect(screen.queryByRole('switch', { name: TOGGLE })).toBeNull()
    render(<Sonda />)
    expect(screen.getByTestId('sonda')).toHaveTextContent('vieja')
  })

  it('si SecureStore falla al leer, queda apagado', async () => {
    mockGetItem.mockRejectedValue(new Error('x'))
    await useVentaNuevaStore.getState().hydrate()
    expect(useVentaNuevaStore.getState()).toMatchObject({ activa: false, isHydrated: true })
  })
})
