/**
 * Audit tranche 1, S2 correction: the fingerprint decision and credential belong to one username. Since M9 (SEG-04,
 * owner's decision #23) a forced logout deletes them too, so the next person never sees "Entrar con huella" for the
 * previous one. A credential left on the phone by an older build (which kept it on a forced logout) is still
 * deleted when someone else logs in with a password, and the offer shows for the new person.
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
import { acceptBiometricLogin, hasSavedCredentials, setBiometricLoginEnabled } from '../../utils/biometrics'

const CREDENCIAL = 'forward_biometric_credentials'

beforeEach(() => {
  mockSecure.clear()
  useOfertaDeHuella.getState().descartar()
  ;(useAuth as jest.Mock).mockReturnValue({
    login: jest.fn().mockResolvedValue(true), isLoading: false, error: null, isLocked: false, failedAttempts: 0,
  })
})

it('A accepted the fingerprint; a forced logout deletes it: no "Entrar con huella", and B is asked', async () => {
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  await acceptBiometricLogin({ username: 'ana.g', password: 'deAna' })
  await cerrarSesion({ forzado: true })
  expect(mockSecure.has(CREDENCIAL)).toBe(false)
  expect(await hasSavedCredentials()).toBe(false)

  render(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>)
  await screen.findByRole('button', { name: 'Ingresar' })
  expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Usuario o email'), 'beto.r')
  fireEvent.changeText(screen.getByLabelText('Contraseña'), 'deBeto')
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }))

  await waitFor(() => expect(useOfertaDeHuella.getState().pendiente).toEqual({ username: 'beto.r', password: 'deBeto' }))
  expect(mockSecure.has(CREDENCIAL)).toBe(false)
})

it('A\'s credential left by an older build (kept on a forced logout): B logs in with a password, it goes, B is asked', async () => {
  await acceptBiometricLogin({ username: 'ana.g', password: 'deAna' })
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

const entrarConContrasenia = async (usuario: string, clave: string) => {
  const vista = render(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>)
  fireEvent.changeText(screen.getByLabelText('Usuario o email'), usuario)
  fireEvent.changeText(screen.getByLabelText('Contraseña'), clave)
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }))
  return vista
}

it('A turned it on in Mi cuenta and logged in; after a forced logout B logs in: A\'s credential goes, B is asked', async () => {
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
  await setBiometricLoginEnabled(true, 'ana.g')
  const deAna = await entrarConContrasenia('ana.g', 'deAna')
  await waitFor(() => expect(mockSecure.get(CREDENCIAL)).toBe(JSON.stringify({ username: 'ana.g', password: 'deAna' })))
  expect(useOfertaDeHuella.getState().pendiente).toBeNull()
  deAna.unmount()
  await cerrarSesion({ forzado: true })
  expect(mockSecure.has(CREDENCIAL)).toBe(false)

  await entrarConContrasenia('beto.r', 'deBeto')
  await waitFor(() => expect(useOfertaDeHuella.getState().pendiente).toEqual({ username: 'beto.r', password: 'deBeto' }))
  expect(mockSecure.has(CREDENCIAL)).toBe(false)
  expect(await hasSavedCredentials()).toBe(false)
})
