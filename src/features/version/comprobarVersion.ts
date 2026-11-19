import { obtenerVersionMinima } from './appMovil'
import { logger } from '@/core/utils/logger'
import { estaDesactualizada } from './semver'

export interface ResultadoDeVersion {
  bloquea: boolean
  minima: string | null
}

/**
 * OPS-03: asks the server for the minimum app version and says whether the installed one is older. Never throws and
 * blocks only on a clear "older": null, a 404 (old server), a network error, a timeout or an invalid value let the app
 * run, so an offline driver keeps working.
 */
export async function comprobarVersion(instalada: string | null | undefined): Promise<ResultadoDeVersion> {
  if (!instalada) return { bloquea: false, minima: null }
  try {
    const minima = await obtenerVersionMinima()
    return { bloquea: estaDesactualizada(instalada, minima), minima }
  } catch (err) {
    logger.info(`Minimum version check skipped: ${err instanceof Error ? err.message : 'unknown'}`)
    return { bloquea: false, minima: null }
  }
}
