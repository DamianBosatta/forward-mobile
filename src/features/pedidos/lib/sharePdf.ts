/**
 * sharePdf.ts
 *
 * Authenticated PDF (or .xlsx) download → OS share sheet helper.
 * Design D1: fetch authed PDF URL → write to FileSystem.cacheDirectory
 * → open via Sharing.shareAsync. Never throws across the UI boundary;
 * always returns a typed SharePdfResult.
 */

// expo-file-system SDK 54 split the API: the legacy-compatible functions
// (cacheDirectory, writeAsStringAsync, deleteAsync, EncodingType) live under
// the /legacy sub-path. The root export exposes only the new File/Directory API.
import * as FileSystem from 'expo-file-system/legacy'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ApiError, DESCARGA_TIMEOUT_MS, descargarConAuth, reintentarTrasRenovar, tokenActual } from '@/core/api/client'
import { esTiempoAgotado } from '@/core/api/errores'

const SESION_EXPIRADA = 'Sesión expirada. Por favor, volvé a iniciar sesión.'

// expo-sharing pulls in the ExpoSharing NATIVE module the moment it is evaluated. If the
// installed dev/runtime build was compiled before expo-sharing was added to the project, a
// top-level `import ... from 'expo-sharing'` throws "Cannot find native module 'ExpoSharing'"
// — and because that throw happens at module load, EVERY route that imports this file loses
// its default export and gets dropped from the expo-router tree (ventas/index, ventas/nueva,
// logistica/pedidos...). So load it lazily and guard it: a missing native module degrades to
// an "unavailable" result instead of taking unrelated screens down with it.
type SharingModule = typeof import('expo-sharing')
let sharingModuleCache: SharingModule | null | undefined
export function getSharing(): SharingModule | null {
  if (sharingModuleCache === undefined) {
    try {
      sharingModuleCache = require('expo-sharing') as SharingModule
    } catch {
      sharingModuleCache = null
    }
  }
  return sharingModuleCache
}

/** Mime type and iOS UTI of the shared file, from its extension: PDF (default) or Excel (.xlsx). */
function tipoDeArchivo(fileName: string): { mimeType: string; UTI: string } {
  if (fileName.toLowerCase().endsWith('.xlsx')) {
    return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' }
  }
  return { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }
}

export type SharePdfResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'network' | 'unavailable' | 'unknown' | 'cancelled'; message: string; status?: number }

export interface SharePdfOptions {
  /**
   * HTTP method for the fetch call. Defaults to 'GET' (backward-compatible).
   * Use 'POST' for endpoints that require a request body (e.g. lista-surtido-pdf).
   */
  method?: 'GET' | 'POST'
  /**
   * Request body, serialized as JSON. Only used when method is 'POST'.
   */
  body?: Record<string, unknown>
  /**
   * Download progress. Passing it (or `signal`) switches to a streamed download straight to the cache file
   * (GET only): `total` is 0 when the server did not send Content-Length. Without it the download is the usual one.
   */
  onProgress?: (progreso: { written: number; total: number }) => void
  /** Aborting it cancels the download: the result is `reason: 'cancelled'` and the partial file is removed. */
  signal?: AbortSignal
}


/**
 * Streamed download to `uri` with progress and cancel. Same Bearer token, one 401 renewal (the shared mutex of
 * `attemptRefresh`) and one retry, and the same 120 s limit as the fetch path. Removes the file on any failure.
 */
async function descargarConProgreso(url: string, uri: string, options: SharePdfOptions): Promise<SharePdfResult> {
  const { onProgress, signal } = options
  const borrar = () => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  const cancelada = (): SharePdfResult => ({ ok: false, reason: 'cancelled', message: 'Descarga cancelada.' })
  if (signal?.aborted) return cancelada()

  const intento = async (esReintento: boolean): Promise<{ status: number } | 'cancelada' | 'tiempo' | 'error'> => {
    // Also covers a cancel that landed while the token was being renewed: the abort event already fired by then.
    if (signal?.aborted) return 'cancelada'
    // The 401 attempt may have left a partial file (the error body).
    if (esReintento) await borrar()
    const descarga = FileSystem.createDownloadResumable(
      url,
      uri,
      { headers: tokenActual() ? { Authorization: `Bearer ${tokenActual()}` } : {} },
      (p) => onProgress?.({ written: p.totalBytesWritten, total: p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : 0 }),
    )
    let motivo: 'cancelada' | 'tiempo' | null = null
    const parar = (m: 'cancelada' | 'tiempo') => {
      motivo = m
      descarga.cancelAsync().catch(() => {})
    }
    const alAbortar = () => parar('cancelada')
    signal?.addEventListener('abort', alAbortar)
    const reloj = setTimeout(() => parar('tiempo'), DESCARGA_TIMEOUT_MS)
    try {
      const r = await descarga.downloadAsync()
      if (motivo) return motivo
      return r ? { status: r.status } : 'error'
    } catch {
      return motivo ?? 'error'
    } finally {
      clearTimeout(reloj)
      signal?.removeEventListener('abort', alAbortar)
    }
  }

  let r: Awaited<ReturnType<typeof intento>>
  try {
    r = await reintentarTrasRenovar(intento, (x) => typeof x === 'object' && x.status === 401)
  } catch (e) {
    await borrar()
    // Renewal failed: the session is over (ApiError 401), not a connectivity problem.
    if (e instanceof ApiError && e.status === 401) return { ok: false, reason: 'auth', message: SESION_EXPIRADA }
    return { ok: false, reason: 'network', message: 'No se pudo conectar al servidor. Verificá tu conexión.' }
  }

  if (r === 'cancelada') {
    await borrar()
    return cancelada()
  }
  if (r === 'tiempo') {
    await borrar()
    return { ok: false, reason: 'network', message: 'La descarga tardó demasiado. Probá de nuevo.' }
  }
  if (r === 'error') {
    await borrar()
    return { ok: false, reason: 'network', message: 'No se pudo conectar al servidor. Verificá tu conexión.' }
  }
  if (r.status === 401 || r.status === 403) {
    await borrar()
    return { ok: false, reason: 'auth', message: SESION_EXPIRADA }
  }
  if (r.status < 200 || r.status >= 300) {
    await borrar()
    return { ok: false, reason: 'network', status: r.status, message: `Error al descargar el archivo (${r.status}).` }
  }
  return { ok: true }
}

/**
 * Downloads a file (PDF, or Excel when `fileName` ends in .xlsx) from an authenticated API endpoint and opens the
 * OS share sheet.
 *
 * @param url      - Authenticated API URL (e.g. from getEtiquetasUrl / getNotaEntregaUrl)
 * @param fileName - Output file name (e.g. 'etiquetas-abc12345.pdf'); its extension sets the shared mime type
 * @param options  - Optional fetch options. Defaults to GET with no body (backward-compatible).
 * @returns SharePdfResult — never throws
 */
export async function sharePdf(url: string, fileName: string, options?: SharePdfOptions): Promise<SharePdfResult> {
  // 1. Guard: the native sharing module must be present AND available on the device
  const Sharing = getSharing()
  if (!Sharing) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'La función de compartir no está disponible en esta versión de la app. Pedí una actualización para habilitarla.',
    }
  }
  const sharingAvailable = await Sharing.isAvailableAsync().catch(() => false)
  if (!sharingAvailable) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'El dispositivo no admite la función de compartir archivos.',
    }
  }

  // 2. No session at all: do not even try the download
  const token = useAuthStore.getState().accessToken
  if (!token) {
    return {
      ok: false,
      reason: 'auth',
      message: SESION_EXPIRADA,
    }
  }

  // Streamed download (progress / cancel): only when asked; the path below is the one every other caller uses.
  if ((options?.onProgress || options?.signal) && (options.method ?? 'GET') === 'GET') {
    const archivo = (FileSystem.cacheDirectory ?? '') + fileName
    const descargado = await descargarConProgreso(url, archivo, options)
    if (!descargado.ok) return descargado
    if (options.signal?.aborted) {
      FileSystem.deleteAsync(archivo, { idempotent: true }).catch(() => {})
      return { ok: false, reason: 'cancelled', message: 'Descarga cancelada.' }
    }
    try {
      await Sharing.shareAsync(archivo, tipoDeArchivo(fileName))
    } catch {
      return { ok: false, reason: 'unknown', message: 'No se pudo abrir el panel para compartir.' }
    }
    FileSystem.deleteAsync(archivo, { idempotent: true }).catch(() => {})
    return { ok: true }
  }

  // 3. Download the file
  const method = options?.method ?? 'GET'
  // Same client path as `api`: Bearer token, 120 s download timeout and the one 401 renewal + retry (src/core/api).
  const fetchInit: RequestInit = {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
    ...(method === 'POST' && options?.body ? { body: JSON.stringify(options.body) } : {}),
  }

  let response: Response
  try {
    response = await descargarConAuth(url, fetchInit)
  } catch (e) {
    // Renewal failed: the session is over (ApiError 401), not a connectivity problem.
    if (e instanceof ApiError && e.status === 401) {
      return { ok: false, reason: 'auth', message: SESION_EXPIRADA }
    }
    if (esTiempoAgotado(e)) {
      return { ok: false, reason: 'network', message: 'La descarga tardó demasiado. Probá de nuevo.' }
    }
    return {
      ok: false,
      reason: 'network',
      message: 'No se pudo conectar al servidor. Verificá tu conexión.',
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'auth',
        message: SESION_EXPIRADA,
      }
    }
    return {
      ok: false,
      reason: 'network',
      status: response.status,
      message: `Error al descargar el archivo (${response.status}).`,
    }
  }

  // 4. Write to cache directory as base64
  const uri = (FileSystem.cacheDirectory ?? '') + fileName
  try {
    const blob = await response.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        // Strip the data URI prefix (e.g. "data:application/pdf;base64,")
        resolve(result.split(',')[1] ?? result)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    })
  } catch {
    return {
      ok: false,
      reason: 'unknown',
      message: 'No se pudo guardar el archivo temporalmente.',
    }
  }

  // 5. Open the OS share sheet
  try {
    await Sharing.shareAsync(uri, tipoDeArchivo(fileName))
  } catch {
    return {
      ok: false,
      reason: 'unknown',
      message: 'No se pudo abrir el panel para compartir.',
    }
  }

  // Best-effort cleanup (non-blocking, non-throwing)
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})

  return { ok: true }
}
