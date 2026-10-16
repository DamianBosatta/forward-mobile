import React, { useState } from 'react'
import { Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

interface Props {
  /** "del comprobante", "del cheque": arma "Sacar foto …", "Elegir … de la galería" y "Foto … cargada". */
  que: string
  url: string | null
  subir: (uri: string) => Promise<string>
  onUrl: (url: string) => void
  /** Avisa mientras sube: el cobro no se registra con una foto a medio subir. */
  onSubiendo: (subiendo: boolean) => void
}

// Calidad baja: el servidor acepta hasta 2 MB por imagen.
const OPCIONES: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4 }

/** Foto opcional del cobro (cámara o galería), subida en el acto: el reintento del cobro reusa la misma URL. */
export function FotoDelCobro({ que, url, subir, onUrl, onSubiendo }: Props) {
  const c = useColors()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tomar = async (desde: 'camara' | 'galeria') => {
    setError(null)
    const permiso = desde === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      setError(`La app necesita ${desde === 'camara' ? 'la cámara' : 'las fotos'} para esto. Habilitalo en los ajustes del teléfono.`)
      return
    }
    const r = desde === 'camara' ? await ImagePicker.launchCameraAsync(OPCIONES) : await ImagePicker.launchImageLibraryAsync(OPCIONES)
    const foto = r.canceled ? null : r.assets?.[0]
    if (!foto) return
    setSubiendo(true)
    onSubiendo(true)
    try {
      onUrl(await subir(foto.uri))
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo subir la foto. Probá de nuevo.'))
    } finally {
      setSubiendo(false)
      onSubiendo(false)
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      {url ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Foto ${que} cargada`}</Text> : null}
      <Button label={url ? `Volver a sacar la foto ${que}` : `Sacar foto ${que}`} variant="secundario" loading={subiendo} disabled={subiendo} onPress={() => { void tomar('camara') }} />
      <Button label={`Elegir foto ${que} de la galería`} variant="secundario" disabled={subiendo} onPress={() => { void tomar('galeria') }} />
      {error ? <Notice tone="peligro">{error}</Notice> : null}
    </View>
  )
}
