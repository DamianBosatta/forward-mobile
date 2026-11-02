import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * "Entrar con huella" is opt-in (audit tranche 1, S2, owner's decision "Opt-in, con botón"): after the first
 * password login the app asks; only if the person accepts is the credential saved, behind device authentication
 * (`requireAuthentication`). The login screen shows a button and never prompts on its own. A manual logout forgets
 * it; a forced one (session expired) keeps it. The decision and the credential belong to one username.
 */
const BIOMETRIC_CREDENTIALS_KEY = 'forward_biometric_credentials';
/** Plain marker (no authentication) so the login screen can show the button without prompting. */
const BIOMETRIC_SAVED_KEY = 'forward_biometric_saved';
const BIOMETRIC_ENABLED_KEY = 'forward_biometric_enabled';
/** Who took the decision (plain, no authentication): compared at every password login. */
const BIOMETRIC_USER_KEY = 'forward_biometric_user';

const mismaPersona = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const PROTEGIDA = { requireAuthentication: true } as const;

export interface BiometricCredentials {
  username: string;
  password: string;
}

/** `null` means the person was not asked yet (or logged out since). */
export type BiometricChoice = 'enabled' | 'disabled' | null;

export async function isBiometricsAvailable() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/** Saves the credential behind device authentication. It throws if the person cancels that authentication. */
export async function saveCredentials(creds: BiometricCredentials) {
  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(creds), {
    ...PROTEGIDA,
    authenticationPrompt: 'Confirmá que sos vos para guardar la huella',
  });
  await SecureStore.setItemAsync(BIOMETRIC_SAVED_KEY, 'true');
}

/** True when a credential is saved; reads only the plain marker, so it never prompts. */
export async function hasSavedCredentials(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_SAVED_KEY)) === 'true';
}

/** Reads the credential; the system asks for the fingerprint (or the device lock) first. */
export async function getSavedCredentials(): Promise<BiometricCredentials | null> {
  const json = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY, {
    ...PROTEGIDA,
    authenticationPrompt: 'Entrar con huella',
  });
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function clearSavedCredentials() {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_SAVED_KEY);
}

/**
 * The decision for this username. If it was taken by someone else, the decision and the credential are deleted
 * and the person is asked again: another person's credential is never kept or overwritten silently.
 */
export async function getBiometricChoiceFor(username: string): Promise<BiometricChoice> {
  const duenio = await SecureStore.getItemAsync(BIOMETRIC_USER_KEY);
  if (duenio && !mismaPersona(duenio, username)) {
    await forgetBiometricLogin();
    return null;
  }
  return getBiometricChoice();
}

export async function getBiometricChoice(): Promise<BiometricChoice> {
  const valor = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  if (valor === 'true') return 'enabled';
  if (valor === 'false') return 'disabled';
  return null;
}

/** "Entrar con huella" of Mi cuenta (bloque 12, T2). Nothing decided means off. */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  return (await getBiometricChoice()) === 'enabled';
}

/** Turning it off deletes the saved credential; turning it on saves it at the next password login. */
export async function setBiometricLoginEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) await clearSavedCredentials();
}

/** "Sí" to the question after login: saves the credential and turns it on. False if authentication was cancelled. */
export async function acceptBiometricLogin(creds: BiometricCredentials): Promise<boolean> {
  try {
    await saveCredentials(creds);
  } catch {
    await clearSavedCredentials();
    return false;
  }
  await setBiometricLoginEnabled(true);
  await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, creds.username);
  return true;
}

/** "Ahora no": stores no credential and does not ask this person again until a manual logout. */
export async function declineBiometricLogin(username: string) {
  await setBiometricLoginEnabled(false);
  await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, username);
}

/** Manual logout or another person: deletes the credential and the decision, so the next login is asked again. */
export async function forgetBiometricLogin() {
  await clearSavedCredentials();
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY);
}

/**
 * The "Entrar con huella" button. Reading the protected credential is what asks for the fingerprint: one system
 * prompt. Null if unavailable, cancelled or nothing saved.
 */
export async function authenticateWithBiometrics(): Promise<BiometricCredentials | null> {
  if (!(await isBiometricsAvailable())) return null;
  try {
    return await getSavedCredentials();
  } catch {
    return null;
  }
}
