/**
 * Audit tranche 1, S2 correction: the fingerprint decision and credential belong to one username. After a forced
 * logout the phone keeps them for that person; if someone else logs in with a password, they are deleted and the
 * offer shows for the new person. Never a different person's credential saved silently.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v) },
    deleteItemAsync: async (k: string) => { store.delete(k) },
  }
})
const mockSecure: Map<string, string> = jest.requireMock('expo-secure-store').__store
jest.mock('expo-local-authentication', () => ({ hasHardwareAsync: async () => true, isEnrolledAsync: async () => true }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn(), selection: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ isTablet: false }) }))
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {} },
}))
jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }))

import LoginScreen from '../../../../../app/login'
import { useAuth } from '../../hooks/useAuth'
import { cerrarSesion } from '../../lib/cerrarSesion'
import { useAuthStore } from '../../store/auth.store'
import { useOfertaDeHuella } from '../../store/ofertaDeHuella.store'
import { acceptBiometricLogin, hasSavedCredentials } from '../../utils/biometrics'

const CREDENCIAL = 'forward_biometric_credentials'

beforeEach(() => {
  mockSecure.clear()
  useOfertaDeHuella.getState().descartar()
  ;(useAuth as jest.Mock).mockReturnValue({
    login: jest.fn().mockResolvedValue(true), isLoading: false, error: null, isLocked: false, failedAttempts: 0,
  })
})

it('A accepted the fingerprint; after a forced logout B logs in with a password: A\'s credential goes, B is asked', async () => {
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  await acceptBiometricLogin({ username: 'ana.g', password: 'deAna' })
  await cerrarSesion({ forzado: true })
  expect(await hasSavedCredentials()).toBe(true)

  render(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>)
  expect(await screen.findByRole('button', { name: 'Entrar con huella' })).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Usuario o email'), 'beto.r')
  fireEvent.changeText(screen.getByLabelText('Contraseña'), 'deBeto')
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }))

  await waitFor(() => expect(useOfertaDeHuella.getState().pendiente).toEqual({ username: 'beto.r', password: 'deBeto' }))
  expect(mockSecure.has(CREDENCIAL)).toBe(false)
  expect(await hasSavedCredentials()).toBe(false)
})
