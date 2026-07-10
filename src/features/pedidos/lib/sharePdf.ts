/**
 * sharePdf.ts
 *
 * Authenticated PDF download → OS share sheet helper.
 * Design D1: fetch authed PDF URL → write to FileSystem.cacheDirectory
 * → open via Sharing.shareAsync. Never throws across the UI boundary;
 * always returns a typed SharePdfResult.
 */

// expo-file-system SDK 54 split the API: the legacy-compatible functions
// (cacheDirectory, writeAsStringAsync, deleteAsync, EncodingType) live under
// the /legacy sub-path. The root export exposes only the new File/Directory API.
import * as FileSystem from 'expo-file-system/legacy'
import { useAuthStore } from '@/libs/store/auth.store'

// expo-sharing pulls in the ExpoSharing NATIVE module the moment it is evaluated. If the
// installed dev/runtime build was compiled before expo-sharing was added to the project, a
// top-level `import ... from 'expo-sharing'` throws "Cannot find native module 'ExpoSharing'"
// — and because that throw happens at module load, EVERY route that imports this file loses
// its default export and gets dropped from the expo-router tree (ventas/index, ventas/nueva,
// logistica/pedidos...). So load it lazily and guard it: a missing native module degrades to
// an "unavailable" result instead of taking unrelated screens down with it.
type SharingModule = typeof import('expo-sharing')
let sharingModuleCache: SharingModule | null | undefined
function getSharing(): SharingModule | null {
  if (sharingModuleCache === undefined) {
    try {
      sharingModuleCache = require('expo-sharing') as SharingModule
    } catch {
      sharingModuleCache = null
    }
  }
  return sharingModuleCache
}

export type SharePdfResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'network' | 'unavailable' | 'unknown'; message: string }

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
}

/**
 * Downloads a PDF from an authenticated API endpoint and opens the OS share sheet.
 *
 * @param url      - Authenticated API URL (e.g. from getEtiquetasUrl / getNotaEntregaUrl)
 * @param fileName - Output file name (e.g. 'etiquetas-abc12345.pdf')
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

  // 2. Read auth token from store (same source the api client uses)
  const token = useAuthStore.getState().accessToken
  if (!token) {
    return {
      ok: false,
      reason: 'auth',
      message: 'Sesión expirada. Por favor, volvé a iniciar sesión.',
    }
  }

  // 3. Fetch the PDF with the Bearer token
  const method = options?.method ?? 'GET'
  const fetchInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' && options?.body ? { body: JSON.stringify(options.body) } : {}),
  }

  let response: Response
  try {
    response = await fetch(url, fetchInit)
  } catch {
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
        message: 'Sesión expirada. Por favor, volvé a iniciar sesión.',
      }
    }
    return {
      ok: false,
      reason: 'network',
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
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    })
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
