import { API_URL, fetchWithTimeout } from './client'
import type { components } from './generated/schema'

/** The response of the endpoint: generated from openapi.json (X14), not written by hand. */
type RespuestaVersionMinima = components['schemas']['VersionMinimaDtoResponse']

/** The check must never hold the app for long: a slow connection just skips it. */
const PLAZO_VERSION_MINIMA_MS = 4_000

/**
 * GET /api/v1/AppMovil/version-minima (R3 M5a, OPS-03). Anonymous on purpose (owner's decision 2026-11-18): the app
 * asks before the login, so no token is sent and a 401 never triggers a refresh. Returns the minimum supported
 * version, or null when the server does not set one. Throws on a failed call: the caller decides to not block.
 */
export async function obtenerVersionMinima(): Promise<string | null> {
  const response = await fetchWithTimeout(
    `${API_URL}/api/v1/AppMovil/version-minima`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    PLAZO_VERSION_MINIMA_MS,
  )
  if (!response.ok) throw new Error(`version-minima respondió ${response.status}`)
  const cuerpo = (await response.json()) as Partial<RespuestaVersionMinima> | null
  const valor = cuerpo?.data?.versionMinima
  return typeof valor === 'string' ? valor : null
}
