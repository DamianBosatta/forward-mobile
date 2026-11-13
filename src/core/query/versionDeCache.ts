import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

/**
 * `buster` de la caché guardada: versión de la app + id de la actualización OTA. Si cambia cualquiera
 * de los dos, lo guardado se descarta (una forma de dato nueva no se hidrata con la vieja).
 */
export function versionDeCache(): string {
  const version = Constants.expoConfig?.version ?? 'sin-version'
  const actualizacion = Updates.updateId ?? 'embebida'
  return `${version}+${actualizacion}`
}
