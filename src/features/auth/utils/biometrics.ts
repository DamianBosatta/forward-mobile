import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_CREDENTIALS_KEY = 'forward_biometric_credentials';

export interface BiometricCredentials {
  username: string;
  password: string;
}

export async function isBiometricsAvailable() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function saveCredentials(creds: BiometricCredentials) {
  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(creds));
}

export async function getSavedCredentials(): Promise<BiometricCredentials | null> {
  const json = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function clearSavedCredentials() {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
}

const BIOMETRIC_ENABLED_KEY = 'forward_biometric_enabled';

/**
 * "Entrar con huella" de Mi cuenta (bloque 12, T2). Sin elección guardada está prendida: es lo que
 * hacía la app antes de tener el interruptor (siempre guardaba las credenciales al ingresar).
 */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) !== 'false';
}

/** Apagarla borra el usuario y la contraseña guardados; prenderla los guarda en el próximo ingreso. */
export async function setBiometricLoginEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) await clearSavedCredentials();
}

export async function authenticateWithBiometrics(): Promise<BiometricCredentials | null> {
  const available = await isBiometricsAvailable();
  if (!available) return null;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Identificación Biométrica',
    fallbackLabel: 'Usar contraseña',
    disableDeviceFallback: false,
  });

  if (result.success) {
    return await getSavedCredentials();
  }

  return null;
}
