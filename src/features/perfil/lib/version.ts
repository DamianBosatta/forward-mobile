import Constants from 'expo-constants'
import { ddmmaaaa, diaArgentina } from '@/core/utils/fecha'

/** What "Mi cuenta" needs to say which app is running (audit tranche 4, S3). */
export interface DatosDeVersion {
  version?: string | null
  build?: string | null
  /** The OTA update running now; null when the app runs the bundle embedded in the build. */
  actualizacion?: { id: string; creadaEl: Date | null } | null
}

/** "Forward Mobile 1.0.0 (build 12)" and, with an OTA update running, "Actualización a1b2c3d4 del 02/11/2026". */
export function lineasDeVersion({ version, build, actualizacion }: DatosDeVersion): { version: string; actualizacion: string | null } {
  const app = ['Forward Mobile', version, build ? `(build ${build})` : null].filter(Boolean).join(' ')
  if (!actualizacion) return { version: app, actualizacion: null }
  const dia = actualizacion.creadaEl ? ` del ${ddmmaaaa(diaArgentina(actualizacion.creadaEl.getTime()))}` : ''
  return { version: app, actualizacion: `Actualización ${actualizacion.id.slice(0, 8)}${dia}` }
}

/** Loads an optional native-backed module; null when the running build does not include it. */
function opcional<T>(cargar: () => T): T | null {
  try {
    return cargar()
  } catch {
    return null
  }
}

/**
 * Reads version, build and running update from the device. Never throws: a dev client or Expo Go without
 * `expo-application` or `expo-updates`, or with updates disabled, just yields fewer data.
 */
export function leerDatosDeVersion(): DatosDeVersion {
  const application = opcional(() => require('expo-application') as typeof import('expo-application'))
  const updates = opcional(() => require('expo-updates') as typeof import('expo-updates'))
  const config = Constants.expoConfig
  const buildDeConfig = config?.android?.versionCode ?? config?.ios?.buildNumber
  const build = application?.nativeBuildVersion || (buildDeConfig != null ? String(buildDeConfig) : null)
  const corriendoOta = updates?.isEnabled && !updates.isEmbeddedLaunch && updates.updateId
  return {
    version: config?.version ?? null,
    build,
    actualizacion: corriendoOta ? { id: updates.updateId as string, creadaEl: updates.createdAt ?? null } : null,
  }
}
