import { api, API_URL } from './client'

export interface UploadResult {
  url: string
}

export function getFullImageUrl(path?: string | null): string | null {
  if (!path) return null
  
  // Si la ruta ya es absoluta (ej. subida a un bucket en la nube, S3, Cloudinary o archivo local file://)
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://') || path.startsWith('data:')) {
    return path
  }
  
  const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  return `${cleanBase}${cleanPath}`
}

export async function uploadProductImage(uri: string): Promise<string> {
  // En un entorno de React Native / Expo, usamos FormData
  const formData = new FormData()
  
  // Obtenemos el nombre del archivo de la URI
  const filename = uri.split('/').pop() ?? 'image.jpg'
  
  // Inferir el tipo
  const match = /\.(\w+)$/.exec(filename)
  const type = match ? `image/${match[1]}` : `image/jpeg`

  // @ts-ignore - FormData en React Native acepta objetos {uri, name, type}
  formData.append('file', { uri, name: filename, type })

  const response = await api.post<UploadResult>('/api/v1/Media/upload-product', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.url
}

/**
 * Sube una foto de la entrega (remito firmado, comprobante, firma) a la carpeta de entregas
 * (`POST /Media/upload-entrega`, MOD_VIAJES:Update, hasta 2 MB). Devuelve la URL que va en el cuerpo
 * de la entrega: el servidor solo acepta fotos de su propio storage.
 */
export async function uploadFotoEntrega(uri: string): Promise<string> {
  const formData = new FormData()
  const filename = uri.split('/').pop() ?? 'entrega.jpg'
  const match = /\.(\w+)$/.exec(filename)
  const type = match ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}` : 'image/jpeg'
  // @ts-expect-error FormData de React Native acepta {uri, name, type}
  formData.append('file', { uri, name: filename, type })
  const r = await api.post<UploadResult>('/api/v1/Media/upload-entrega', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return r.url
}
