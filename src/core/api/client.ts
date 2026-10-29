import type { TokenResponse, UserProfile } from '@/libs/api-client/types'
import { logger } from '@/src/core/utils/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { mmkvPersister } from '@/core/query/persistConfig'
import { CATALOGO_DE_ERRORES, type CodigoError } from '@/libs/api-client/generated/codigos-error'

// ─────────────────────────────────────────────────────────────────────────────
// API Client Base
// Maneja JWT, refresh automático en 401, timeout, y sanitización de errores
// ─────────────────────────────────────────────────────────────────────────────

export const ENV_PROD = 'https://api.forward-gestion.com.ar'
// The old dev server (api-dev, port 8443) no longer exists: a URL saved for it, or a local .env that
// still points to it, falls back to production.
const ENV_DEV_RETIRADO = 'https://api-dev.forward-gestion.com.ar:8443'
// Local docker API. From the Android emulator, 10.0.2.2 maps to the host machine's localhost.
export const ENV_LOCAL = 'http://10.0.2.2:5000'
const STORAGE_KEY = 'forward_api_url'

/** Single source of truth para la URL del API (live binding mutable) */
const ENV_DEL_BUILD = process.env.EXPO_PUBLIC_API_URL
export let API_URL = ENV_DEL_BUILD && ENV_DEL_BUILD !== ENV_DEV_RETIRADO ? ENV_DEL_BUILD : ENV_PROD

export async function loadSavedApiUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY)
    if (saved && saved !== ENV_DEV_RETIRADO) {
      API_URL = saved
      logger.info(`Loaded API_URL from storage: ${API_URL}`)
    } else {
      logger.info(`No saved API_URL, defaulting to: ${API_URL}`)
    }
  } catch (err) {
    logger.error('Failed to load saved API URL:', err)
  }
  return API_URL
}

export async function setApiUrl(url: string): Promise<void> {
  try {
    const changed = url !== API_URL
    API_URL = url
    await AsyncStorage.setItem(STORAGE_KEY, url)
    logger.info(`Saved and updated API_URL: ${API_URL}`)
    // When the API environment changes, the persisted react-query cache holds
    // data from the previous backend (different DB). Wipe it so the app refetches
    // everything from the new API instead of showing stale data (e.g. old roles).
    if (changed) {
      await mmkvPersister.removeClient()
      logger.info('Cleared persisted query cache after API_URL change')
    }
  } catch (err) {
    logger.error('Failed to save API URL:', err)
  }
}


/** Timeout por request (15s) — previene hang attacks y conexiones zombies */
const REQUEST_TIMEOUT_MS = 15_000

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: string[],
    /**
     * Código estable del catálogo de errores del servidor (`codigo` del ProblemDetails), p. ej. `ClaveIdempotenciaConOtroCuerpo`.
     * Es lo que decide qué hace una pantalla; el texto puede cambiar. `Desconocido`: el servidor mandó un código que este
     * build no conoce; vacío: el error no trae código.
     */
    public codigo?: CodigoError | 'Desconocido',
    /** `data` del sobre de error: lo que el servidor adjunta al rechazo (p. ej. la venta ya grabada en un 409). */
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Token management ─────────────────────────────────────────────────────────

let _getToken: () => string | null = () => null
let _getRefreshToken: () => string | null = () => null
let _onTokensRefreshed: ((tokens: { accessToken: string; refreshToken: string }) => void) | null = null
let _onUnauthorized: (() => void) | null = null

/** El token de acceso vigente (el mismo que usan las requests): lo lee el hub de stock en cada (re)conexión. */
export const tokenActual = (): string | null => _getToken()

// Mutex para prevenir refresh concurrentes
let _isRefreshing = false
let _refreshPromise: Promise<boolean> | null = null

export function configureApiClient(options: {
  getToken: () => string | null
  getRefreshToken: () => string | null
  onTokensRefreshed: (tokens: { accessToken: string; refreshToken: string }) => void
  onUnauthorized: () => void
}) {
  _getToken = options.getToken
  _getRefreshToken = options.getRefreshToken
  _onTokensRefreshed = options.onTokensRefreshed
  _onUnauthorized = options.onUnauthorized
}

// ── Refresh Token Flow ───────────────────────────────────────────────────────

async function attemptRefresh(): Promise<boolean> {
  // Si ya hay un refresh en curso, esperar su resultado (mutex)
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise
  }

  const refreshToken = _getRefreshToken?.()
  if (!refreshToken) {
    logger.warn('No refresh token available, redirecting to login')
    _onUnauthorized?.()
    return false
  }

  logger.info('Attempting to refresh token...')
  _isRefreshing = true
  _refreshPromise = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'forward_mobile',
        // Debe incluir offline_access (mismos scopes que el login) para que el
        // backend emita un refresh token rotado nuevo; sin esto el server no rota
        // y el siguiente refresh falla con invalid_grant.
        scope: 'openid profile email roles offline_access',
      }).toString()

      const response = await fetchWithTimeout(`${API_URL}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        logger.error('Refresh token failed:', response.status)
        // Solo forzar re-login si el refresh token es inválido/expirado (4xx).
        // Ante errores transitorios (5xx, server caído) NO deslogueamos: se
        // preserva la sesión para reintentar; un bajón momentáneo no debe echar
        // al usuario.
        if (response.status >= 400 && response.status < 500) {
          _onUnauthorized?.()
        }
        return false
      }

      const data = await response.json()
      if (!data.refresh_token) {
        // Con offline_access el server SIEMPRE debería rotar el refresh token.
        // Si no vino uno nuevo, lo registramos en vez de ocultarlo: reusar el
        // anterior (ya redimido) hará fallar el próximo refresh.
        logger.warn('Refresh response sin refresh_token rotado — revisar offline_access')
      }
      logger.info('Token refreshed successfully')
      _onTokensRefreshed?.({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
      })
      return true
    } catch (err) {
      // Error de red/timeout → transitorio. NO desloguear; se reintenta luego.
      logger.error('Network error during token refresh (session preserved):', err)
      return false
    } finally {
      _isRefreshing = false
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

// ── Fetch con timeout ────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId))
}

// ── Sanitización de errores ──────────────────────────────────────────────────

const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: 'Datos inválidos. Revisá los campos e intentá de nuevo.',
  401: 'Sesión expirada. Ingresá nuevamente.',
  403: 'No tenés permisos para esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'Conflicto: el dato fue modificado por otro usuario.',
  422: 'No se pudo procesar la solicitud.',
  429: 'Demasiados intentos. Esperá un momento.',
  500: 'Error interno del servidor. Intentá más tarde.',
  502: 'El servidor no está disponible.',
  503: 'Servicio temporalmente no disponible.',
}

function sanitizeErrorMessage(status: number, serverMessage?: string): string {
  // Solo mostrar mensajes del servidor para errores de negocio (400-422)
  // Nunca exponer mensajes de 500+ que pueden contener stack traces
  if (status >= 400 && status < 500 && serverMessage && !serverMessage.includes('Exception')) {
    return serverMessage
  }
  return SAFE_ERROR_MESSAGES[status] ?? `Error inesperado (${status})`
}

/**
 * Unwraps a C# ApiResponse<T> envelope when the JSON has a `succeeded` field.
 * Rule: "it is a wrapper iff the JSON has a `succeeded` field."
 * - succeeded:false → throws ApiError using the envelope's statusCode (or httpStatus fallback)
 * - succeeded:true  → returns .data (or undefined when data key is absent, e.g. delete ops)
 * - no `succeeded`  → returns raw json as-is
 */
function unwrapApiResponse<T>(result: unknown, httpStatus: number): T {
  if (result && typeof result === 'object' && 'succeeded' in result) {
    const env = result as { succeeded: boolean; statusCode?: number; data?: unknown }
    if (env.succeeded === false) {
      throw leerError(result, typeof env.statusCode === 'number' ? env.statusCode : httpStatus)
    }
    return ('data' in env ? env.data : undefined) as T
  }
  return result as T
}

/** Respuesta de `api.postConSobre`: el `data` del sobre y el sobre entero (`null` si no vino sobre, o con 204). */
export interface RespuestaConSobre<T, S> {
  data: T
  sobre: S | null
}

/** Como unwrapApiResponse, pero conserva el sobre para leer los campos que van al lado de `data`. */
function unwrapConSobre<T, S>(result: unknown, httpStatus: number): RespuestaConSobre<T, S> {
  const data = unwrapApiResponse<T>(result, httpStatus)
  const esSobre = !!result && typeof result === 'object' && 'succeeded' in result
  return { data, sobre: esSobre ? (result as S) : null }
}

const esCodigoConocido = (c: string): c is CodigoError => Object.prototype.hasOwnProperty.call(CATALOGO_DE_ERRORES, c)

/** El texto del servidor tal cual vino (sin sanear): para el registro, nunca para la pantalla. */
const textoCrudo = (cuerpo: unknown): string => {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>
  return texto(c.message) ?? texto(c.detail) ?? 'Unknown error'
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)

/**
 * `errors` del cuerpo como lista de textos. El ProblemDetails nuevo lo manda como diccionario
 * campo → mensajes (`general` para lo que no es de un campo); el sobre viejo, como lista.
 */
function mensajesDe(errors: unknown): string[] | undefined {
  const valores = Array.isArray(errors)
    ? errors
    : errors && typeof errors === 'object' ? Object.values(errors).flat() : undefined
  return valores ? valores.filter((m): m is string => typeof m === 'string' && m !== '') : undefined
}

/**
 * El único lector de cuerpos de error y el único lugar que arma un {@link ApiError}. Lee el
 * ProblemDetails de la API (`codigo`, `detail`, `errors` como diccionario), el sobre viejo (`message`,
 * `errors` como lista) y lo que venga con cualquier status. El texto se sanea según el status.
 */
export function leerError(cuerpo: unknown, status: number): ApiError {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>
  const codigo = texto(c.codigo)
  return new ApiError(
    status,
    sanitizeErrorMessage(status, texto(c.message) ?? texto(c.detail)),
    mensajesDe(c.errors),
    codigo === undefined ? undefined : esCodigoConocido(codigo) ? codigo : 'Desconocido',
    c.data ?? undefined,
  )
}

// ── Core fetch con auth ──────────────────────────────────────────────────────

/** Opciones de `api.get`: las de fetch más los estados de error que el llamador espera y maneja. */
export interface OpcionesGet extends RequestInit {
  /**
   * Estados que no son una falla para quien llama (p. ej. 404 de un servidor que todavía no tiene el
   * endpoint): igual lanzan ApiError, pero no se registran como error (ni van a Sentry).
   */
  estadosEsperados?: number[]
}

async function fetchWithAuth<T>(
  endpoint: string,
  { estadosEsperados, ...options }: OpcionesGet = {},
  leer: (json: unknown, status: number) => T = unwrapApiResponse,
): Promise<T> {
  const token = _getToken()
  const isFormData = options.body instanceof FormData

  const headers = new Headers(
    isFormData ? {} : { 'Content-Type': 'application/json' }
  )

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Merge manual headers (vienen del segundo argumento de api.get/post/etc)
  if (options.headers) {
    const manualHeaders = new Headers(options.headers)
    manualHeaders.forEach((value: string, key: string) => {
      // Skip Content-Type for FormData — el browser lo gestiona con el boundary
      if (isFormData && key.toLowerCase() === 'content-type') return
      headers.set(key, value)
    })
  }

  const url = `${API_URL}${endpoint}`;
  logger.info(`API Request: ${options.method || 'GET'} ${endpoint}`)

  const response = await fetchWithTimeout(url, { ...options, headers })

  // Silent refresh on 401
  if (response.status === 401) {
    const refreshed = await attemptRefresh()
    if (refreshed) {
      // Reintentar con el nuevo token
      const newToken = _getToken()
      headers.set('Authorization', `Bearer ${newToken}`)
      const retryResponse = await fetchWithTimeout(url, { ...options, headers })

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}))
        throw leerError(errorData, retryResponse.status)
      }

      if (retryResponse.status === 204) return undefined as T
      const retryJson = await retryResponse.json()
      return leer(retryJson, retryResponse.status)
    } else {
      throw new ApiError(401, 'Sesión expirada')
    }
  }

    if (!response.ok) {
      let errorData: unknown = null
      try {
        errorData = await response.json()
      } catch {}
      const error = leerError(errorData, response.status)
      if (estadosEsperados?.includes(response.status)) logger.info(`API [${response.status}] esperado ${endpoint}`)
      else logger.error(`API Error [${response.status}] ${endpoint}:`, textoCrudo(errorData))
      
      throw error
    }

  // 204 No Content
  if (response.status === 204) return undefined as T

  const result = await response.json()
  return leer(result, response.status)
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────
export const api = {
  get: <T>(endpoint: string, options: OpcionesGet = {}) =>
    fetchWithAuth<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options: RequestInit = {}) =>
    fetchWithAuth<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData || body instanceof Blob
        ? body
        : body ? JSON.stringify(body) : options.body,
    }),

  /**
   * POST que devuelve también el sobre entero, para los campos que el servidor manda al lado de
   * `data` (p. ej. `tipoCuenta` al registrar un cobro). `api.post` sigue devolviendo solo `data`.
   */
  postConSobre: async <T, S extends object = Record<string, unknown>>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {},
  ): Promise<RespuestaConSobre<T, S>> =>
    (await fetchWithAuth(
      endpoint,
      {
        ...options,
        method: 'POST',
        body: body instanceof FormData || body instanceof Blob
          ? body
          : body ? JSON.stringify(body) : options.body,
      },
      (json, status) => unwrapConSobre<T, S>(json, status),
    )) ?? { data: undefined as T, sobre: null },

  put: <T>(endpoint: string, body?: unknown, options: RequestInit = {}) =>
    fetchWithAuth<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData || body instanceof Blob
        ? body
        : body ? JSON.stringify(body) : options.body,
    }),

  patch: <T>(endpoint: string, body?: unknown, options: RequestInit = {}) =>
    fetchWithAuth<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData || body instanceof Blob
        ? body
        : body ? JSON.stringify(body) : options.body,
    }),

  delete: <T>(endpoint: string, body?: unknown, options: RequestInit = {}) =>
    fetchWithAuth<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
}

export { ApiError }
export type { UserProfile }
