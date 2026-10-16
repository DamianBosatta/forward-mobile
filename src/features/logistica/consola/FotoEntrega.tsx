import React, { useState } from 'react'
import { Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { uploadFotoEntrega } from '@/libs/api-client/media'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

interface Props {
  /** "del remito firmado", "del comprobante del cobro 2"… arma "Sacar foto …" y "Foto … cargada". */
  que: string
  url: string | null
  onUrl: (url: string) => void
  /** Avisa mientras sube: la entrega no se confirma con una foto a medio subir. */
  onSubiendo: (subiendo: boolean) => void
  ayuda?: string
}

/** Foto con la cámara del teléfono, subida en el acto a `upload-entrega`: el reintento de la entrega reusa la misma URL. */
export function FotoEntrega({ que, url, onUrl, onSubiendo, ayuda }: Props) {
  const c = useColors()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sacar = async () => {
    setError(null)
    const permiso = await ImagePicker.requestCameraPermissionsAsync()
    if (!permiso.granted) {
      setError('La app necesita la cámara para la foto. Habilitala en los ajustes del teléfono.')
      return
    }
    // Calidad baja: el servidor acepta hasta 2 MB por foto.
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4 })
    const foto = r.canceled ? null : r.assets?.[0]
    if (!foto) return
    setSubiendo(true)
    onSubiendo(true)
    try {
      onUrl(await uploadFotoEntrega(foto.uri))
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo subir la foto. Probá de nuevo.'))
    } finally {
      setSubiendo(false)
      onSubiendo(false)
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      {ayuda ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ayuda}</Text> : null}
      {url ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Foto ${que} cargada`}</Text> : null}
      <Button
        label={url ? `Volver a sacar la foto ${que}` : `Sacar foto ${que}`}
        variant="secundario"
        loading={subiendo}
        onPress={sacar}
      />
      {error ? <Notice tone="peligro">{error}</Notice> : null}
    </View>
  )
}
