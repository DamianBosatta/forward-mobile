/**
 * Bloque 12, T2 (D11, R15): "Entrar con huella" se prende y se apaga desde Mi cuenta.
 * Apagarla borra el usuario y la contraseña guardados en el teléfono.
 */
const mockStore = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockStore.set(k, v) }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k) }),
}))
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}))

import {
  getSavedCredentials,
  isBiometricLoginEnabled,
  saveCredentials,
  setBiometricLoginEnabled,
} from '../utils/biometrics'

beforeEach(() => mockStore.clear())

describe('entrar con huella', () => {
  it('sin elección guardada está prendida, como antes del interruptor', async () => {
    expect(await isBiometricLoginEnabled()).toBe(true)
  })

  it('apagarla la deja apagada y borra el usuario y la contraseña guardados', async () => {
    await saveCredentials({ username: 'emanuel.p', password: 'secreta' })
    await setBiometricLoginEnabled(false)
    expect(await isBiometricLoginEnabled()).toBe(false)
    expect(await getSavedCredentials()).toBeNull()
  })

  it('volver a prenderla no inventa credenciales: se guardan en el próximo ingreso con contraseña', async () => {
    await setBiometricLoginEnabled(false)
    await setBiometricLoginEnabled(true)
    expect(await isBiometricLoginEnabled()).toBe(true)
    expect(await getSavedCredentials()).toBeNull()
  })
})
