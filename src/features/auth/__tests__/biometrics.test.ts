/**
 * Audit tranche 1, S2: "Entrar con huella" is opt-in, owner's decision "Opt-in, con botón":
 * "Después del primer login la app pregunta si querés entrar con huella la próxima vez. Solo si aceptás se guarda
 * la credencial, protegida con autenticación del dispositivo. Al abrir la app aparece un botón "Entrar con huella",
 * no se dispara sola. Se borra al cerrar sesión."
 * Mi cuenta can still turn it off (bloque 12, T2): turning it off deletes the saved credential.
 */
const mockStore = new Map<string, string>()
const mockOptions = new Map<string, unknown>()
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string, o?: unknown) => { mockStore.set(k, v); mockOptions.set(k, o) }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k); mockOptions.delete(k) }),
}))
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
}))

import * as SecureStore from 'expo-secure-store'
import {
  acceptBiometricLogin,
  authenticateWithBiometrics,
  declineBiometricLogin,
  forgetBiometricLogin,
  getBiometricChoice,
  getBiometricChoiceFor,
  hasSavedCredentials,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
} from '../utils/biometrics'

const CREDENCIAL = 'forward_biometric_credentials'
const CREDS = { username: 'emanuel.p', password: 'secreta' }
const DECISION = 'forward_biometric_enabled'

beforeEach(() => {
  jest.clearAllMocks()
  mockStore.clear()
  mockOptions.clear()
})

describe('entrar con huella (opt-in)', () => {
  it('nothing decided: it is off and nothing is saved', async () => {
    expect(await getBiometricChoice()).toBeNull()
    expect(await isBiometricLoginEnabled()).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
  })

  it('declining stores no credential and records the decision', async () => {
    await declineBiometricLogin(CREDS.username)
    expect(mockStore.has(CREDENCIAL)).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
    expect(await getBiometricChoice()).toBe('disabled')
  })

  it('accepting stores the credential protected with device authentication', async () => {
    expect(await acceptBiometricLogin(CREDS)).toBe(true)
    expect(JSON.parse(mockStore.get(CREDENCIAL)!)).toEqual(CREDS)
    expect(mockOptions.get(CREDENCIAL)).toMatchObject({ requireAuthentication: true })
    expect(await hasSavedCredentials()).toBe(true)
    expect(await isBiometricLoginEnabled()).toBe(true)
  })

  it('entering with the fingerprint reads the credential behind device authentication', async () => {
    await acceptBiometricLogin(CREDS)
    expect(await authenticateWithBiometrics()).toEqual(CREDS)
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(CREDENCIAL, expect.objectContaining({ requireAuthentication: true }))
  })

  it('cancelling the device authentication while accepting enables nothing', async () => {
    ;(SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(async () => { throw new Error('cancelled') })
    expect(await acceptBiometricLogin(CREDS)).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
    expect(await isBiometricLoginEnabled()).toBe(false)
  })

  it('forgetting it (logout) deletes the credential and the decision', async () => {
    await acceptBiometricLogin(CREDS)
    await forgetBiometricLogin()
    expect(mockStore.has(CREDENCIAL)).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
    expect(await getBiometricChoice()).toBeNull()
  })

  it('the decision belongs to the person who took it: another username forgets it and is asked again', async () => {
    await acceptBiometricLogin(CREDS)
    expect(await getBiometricChoiceFor('ana.g')).toBeNull()
    expect(mockStore.has(CREDENCIAL)).toBe(false)
    expect(mockStore.has(DECISION)).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
  })

  it('the same username (any case or spaces) keeps the decision and the credential', async () => {
    await acceptBiometricLogin(CREDS)
    expect(await getBiometricChoiceFor(' Emanuel.P ')).toBe('enabled')
    expect(await hasSavedCredentials()).toBe(true)
  })

  it('a decline by one person does not stop the offer for another', async () => {
    await declineBiometricLogin('emanuel.p')
    expect(await getBiometricChoiceFor('emanuel.p')).toBe('disabled')
    expect(await getBiometricChoiceFor('ana.g')).toBeNull()
  })

  it('turning it off in Mi cuenta deletes the saved credential', async () => {
    await acceptBiometricLogin(CREDS)
    await setBiometricLoginEnabled(false)
    expect(await isBiometricLoginEnabled()).toBe(false)
    expect(mockStore.has(CREDENCIAL)).toBe(false)
    expect(await hasSavedCredentials()).toBe(false)
  })
})
