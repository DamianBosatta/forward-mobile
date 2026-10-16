import { api } from '@/core/api/client'
import type { UploadResult } from '@/libs/api-client/media'

/**
 * Roles que suben la foto de un cheque en el servidor sin permiso de módulo (`ChequesController.RolesDeGestion`).
 * Además la sube quien puede cobrar (MOD_PAGOS:Create), desde el cierre del bloque 9.
 */
export const ROLES_FOTO_CHEQUE = ['Administrador', 'AdministradorSistemas', 'Gerencia'] as const

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

/** Foto del cheque recibido: la sube quien cobra (MOD_PAGOS:Create) o gestión (`ROLES_FOTO_CHEQUE`). */
export const subirFotoCheque = (uri: string) => subirImagen('/api/v1/Media/upload-cheque', uri)
