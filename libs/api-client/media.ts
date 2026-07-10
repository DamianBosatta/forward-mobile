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
