import * as FileSystem from 'expo-file-system/legacy'

export type CompartirFotoResultado = { ok: true } | { ok: false; message: string }

function extensionDe(url: string): 'jpg' | 'png' | 'webp' {
  const ext = /\.(png|webp|jpe?g)(?:\?|#|$)/i.exec(url)?.[1]?.toLowerCase()
  return ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg'
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

/** Baja la foto del producto al caché y abre el panel de compartir. Nunca lanza. */
export async function compartirFoto(url: string, codigo: string): Promise<CompartirFotoResultado> {
  // Lazy: un build sin el módulo nativo de expo-sharing no debe tirar abajo la pantalla (ver sharePdf).
  let Sharing: typeof import('expo-sharing')
  try {
    Sharing = require('expo-sharing') as typeof import('expo-sharing')
  } catch {
    return { ok: false, message: 'La función de compartir no está disponible en esta versión de la app.' }
  }
  if (!(await Sharing.isAvailableAsync().catch(() => false))) {
    return { ok: false, message: 'El dispositivo no admite la función de compartir archivos.' }
  }
  const ext = extensionDe(url)
  const destino = `${FileSystem.cacheDirectory ?? ''}foto-${codigo.replace(/[^\w-]/g, '_')}.${ext}`
  let uri: string
  try {
    const r = await FileSystem.downloadAsync(url, destino)
    if (r.status < 200 || r.status >= 300) return { ok: false, message: 'No se pudo bajar la foto.' }
    uri = r.uri
  } catch {
    return { ok: false, message: 'No se pudo bajar la foto. Verificá tu conexión.' }
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: MIME[ext] })
  } catch {
    return { ok: false, message: 'No se pudo abrir el panel para compartir.' }
  }
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  return { ok: true }
}
