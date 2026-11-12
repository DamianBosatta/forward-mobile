/** El ingreso no se mete bajo la barra de estado ni bajo la barra de navegación del sistema (edge-to-edge). */
import React from 'react'
import { ScrollView } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginScreen from '../../../../../app/login'
import { useAuth } from '../../hooks/useAuth'
import { TEMAS, conTema } from '@/core/ui/fw/__testing__/tema'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 20, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn(), selection: jest.fn() } }))
let mockResponsive = { isTablet: false }
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => mockResponsive }))
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { addEventListener: () => () => {} } }))
jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('../../utils/biometrics', () => ({
  isBiometricsAvailable: async () => false,
  hasSavedCredentials: async () => false,
  getBiometricChoice: async () => null,
  getBiometricChoiceFor: async () => null,
  isBiometricLoginEnabled: async () => false,
  saveCredentials: jest.fn(),
  authenticateWithBiometrics: jest.fn(),
}))

const montar = () => {
  ;(useAuth as jest.Mock).mockReturnValue({ login: jest.fn(), isLoading: false, error: null, isLocked: false, failedAttempts: 0 })
  render(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>)
  return screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle as { paddingTop: number; paddingBottom: number }
}

describe.each(TEMAS)('Ingreso: bordes del sistema (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('teléfono: deja lugar arriba (barra de estado) y abajo (barra de navegación)', () => {
    mockResponsive = { isTablet: false }
    const s = montar()
    expect(s.paddingTop).toBe(30 + 32)
    // Abajo, la barra de navegación la absorbe el pie fijo (PieFijo suma el inset con el teclado cerrado).
    const contenido = screen.getByTestId('login-pie-contenido', { includeHiddenElements: true })
    expect(contenido.props.style.paddingBottom).toBe(16 + 20)
  })

  it('tablet: el formulario también respeta ambos bordes', () => {
    mockResponsive = { isTablet: true }
    const s = montar()
    expect(s.paddingTop).toBe(64 + 30)
    expect(s.paddingBottom).toBe(64 + 20)
  })
})
