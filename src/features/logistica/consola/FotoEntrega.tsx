import React, { useState } from 'react'
import { Image, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { uploadFotoEntrega } from '@/libs/api-client/media'
import { partesArgentina } from '@/src/utils/date'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { CamaraChofer } from './CamaraChofer'

interface Props {
  /** "del remito firmado", "del comprobante del cobro 2"… arma "Sacar foto …" y "Foto … cargada". */
  que: string
  url: string | null
  onUrl: (url: string) => void
  /** Avisa mientras sube: la entrega no se confirma con una foto a medio subir. */
  onSubiendo: (subiendo: boolean) => void
  ayuda?: string
  /** Lámina ChoferCamara: cómo encuadrar. Se muestra mientras no hay foto. */
  guia?: string
  /** Lámina ChoferEntrega/ChoferListo: título de la sección con su estado (Obligatoria, Opcional, Lista). */
  titulo?: string
  obligatoria?: boolean
  /** Lámina ChoferListo: qué foto es ("Remito NTE16918"). */
  referencia?: string
  /** Lámina ChoferCamara: dónde (la dirección de la parada), en el subtítulo de la cámara. */
  lugar?: string
}

/** Lámina Camara (E5): solo la cámara del teléfono, nunca la galería. */
const SIN_GALERIA = 'Sin galería: la foto se saca ahora, para que no se pueda usar una vieja.'

const hhmm = (ms: number) => {
  const p = partesArgentina(ms)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/** Foto con la cámara propia de la app (lámina ChoferCamara), subida en el acto a `upload-entrega`: el reintento de la entrega reusa la misma URL. */
export function FotoEntrega({ que, url, onUrl, onSubiendo, ayuda, guia, titulo, obligatoria, referencia, lugar }: Props) {
  const c = useColors()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sacadaA, setSacadaA] = useState<number | null>(null)

  const [camara, setCamara] = useState(false)

  const sacar = () => {
    setError(null)
    setCamara(true)
  }

  const subir = async (uri: string) => {
    setCamara(false)
    setSubiendo(true)
    onSubiendo(true)
    try {
      onUrl(await uploadFotoEntrega(uri))
      setSacadaA(Date.now())
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo subir la foto. Probá de nuevo.'))
    } finally {
      setSubiendo(false)
      onSubiendo(false)
    }
  }

  const estado = url ? 'Lista' : obligatoria ? 'Obligatoria' : 'Opcional'
  return (
    <View accessibilityLabel={titulo} style={{ gap: space[2] }}>
      {titulo ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ ...typeScale.seccion, color: c.text }}>{titulo}</Text>
          <Text style={{ ...typeScale.secundario, color: url ? c.brandInk : c.textSecondary }}>{estado}</Text>
        </View>
      ) : null}
      {ayuda ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ayuda}</Text> : null}
      {!url && guia ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{guia}</Text> : null}
      {!url ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{SIN_GALERIA}</Text> : null}
      {url ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Image
            source={{ uri: url }}
            accessibilityLabel={`Miniatura de la foto ${que}`}
            style={{ width: 56, height: 72, borderRadius: radii.campo, backgroundColor: c.border }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Foto ${que} cargada`}</Text>
            {referencia || sacadaA ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                {[referencia, sacadaA ? `Sacada a las ${hhmm(sacadaA)}` : null, 'se adjunta a la venta'].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <Button
        label={url ? `Volver a sacar la foto ${que}` : `Sacar foto ${que}`}
        variant="secundario"
        loading={subiendo}
        onPress={sacar}
      />
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <CamaraChofer
        visible={camara}
        titulo={titulo ?? `Foto ${que}`}
        subtitulo={[referencia, lugar].filter(Boolean).join(' · ') || undefined}
        guia={guia}
        onCerrar={() => setCamara(false)}
        onFoto={(uri) => void subir(uri)}
      />
    </View>
  )
}
