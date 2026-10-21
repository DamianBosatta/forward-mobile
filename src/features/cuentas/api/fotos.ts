import { api } from '@/core/api/client'
import type { UploadResult } from '@/libs/api-client/media'

/** Sube una imagen (hasta 2 MB) y devuelve la URL de nuestro storage, la única que el cobro acepta. */
async function subirImagen(endpoint: string, uri: string): Promise<string> {
  const formData = new FormData()
  const filename = uri.split('/').pop() ?? 'foto.jpg'
  const ext = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase()
  const type = !ext || ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  // @ts-expect-error FormData de React Native acepta {uri, name, type}
  formData.append('file', { uri, name: filename, type })
  const r = await api.post<UploadResult>(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return r.url
}

/** Comprobante del cobro: la captura de la transferencia o el ticket del depósito (cualquier usuario). */
export const subirComprobanteCobro = (uri: string) => subirImagen('/api/v1/Media/upload-comprobante', uri)

/** Foto del cheque recibido: la sube quien cobra (MOD_PAGOS:Create) o quien gestiona cheques (`CAP_GESTIONAR_CHEQUES`). */
export const subirFotoCheque = (uri: string) => subirImagen('/api/v1/Media/upload-cheque', uri)
