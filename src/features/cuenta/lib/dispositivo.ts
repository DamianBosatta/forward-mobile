/**
 * Nombre legible de un dispositivo a partir del User-Agent que guarda el servidor en cada sesión
 * (`GET /Sessions` → `device` viene crudo). Es heurístico: el User-Agent no es confiable, así que
 * lo que no se reconoce cae en "Dispositivo desconocido" en lugar de adivinar.
 */
export const DISPOSITIVO_DESCONOCIDO = 'Dispositivo desconocido'

/**
 * La app no manda un User-Agent propio (el cliente de `src/core/api/client.ts` usa `fetch` a secas),
 * así que llega el de la plataforma: OkHttp en Android ("okhttp/4.12.0") y CFNetwork en iOS
 * ("Forward%20ERP/1 CFNetwork/1494.0.7 Darwin/23.4.0", o "Expo/…" dentro de Expo Go).
 */
const APPS: [RegExp, string][] = [
  [/^okhttp\//i, 'Android · App Forward'],
  [/^[^/\s]+\/[\d.]+ CFNetwork\/[\d.]+ Darwin\//i, 'iOS · App Forward'],
]

// Orden importa: el User-Agent de iPhone dice "like Mac OS X" y el de Android dice "Linux".
const SISTEMAS: [RegExp, string][] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows\b/, 'Windows'],
  [/\bMacintosh\b|\bMac OS X\b/, 'Mac'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bLinux\b|\bX11\b/, 'Linux'],
]

// Orden importa: Edge y Opera también dicen "Chrome" y "Safari"; Chrome también dice "Safari".
const NAVEGADORES: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOPT\/|\bOpera\b/, 'Opera'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
]

function primero(tabla: [RegExp, string][], ua: string): string | null {
  return tabla.find(([patron]) => patron.test(ua))?.[1] ?? null
}

/** "Windows · Chrome", "iPhone · Safari", "Android · App Forward"; sin datos, "Dispositivo desconocido". */
export function nombreDeDispositivo(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim()
  if (!ua) return DISPOSITIVO_DESCONOCIDO

  const app = primero(APPS, ua)
  if (app) return app

  const partes = [primero(SISTEMAS, ua), primero(NAVEGADORES, ua)].filter((p): p is string => p !== null)
  return partes.length > 0 ? partes.join(' · ') : DISPOSITIVO_DESCONOCIDO
}
