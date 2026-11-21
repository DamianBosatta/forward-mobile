import React from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'
import { Camera, Check } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { CamaraChofer } from './CamaraChofer'
import { useFotoEntrega } from './FotoEntrega'

interface Props {
  /** Sin dinero cobrado (o con la exigencia de la hoja) no se cierra la entrega sin la foto. */
  obligatoria: boolean
  url: string | null
  onUrl: (url: string) => void
  onSubiendo: (subiendo: boolean) => void
  /** "Remito NTE16918", en el subtítulo de la cámara. */
  referencia?: string
  /** La dirección de la parada, en el subtítulo de la cámara. */
  lugar?: string
}

const GUIA = 'Encuadrá el remito entero, con la firma y la aclaración a la vista'

/**
 * Paso 4 (maqueta cobro-chofer, S8): "Firmar" es la foto del remito firmado. Un botón verde grande que abre la cámara
 * propia directo; con la foto lista queda la fila "Remito firmado", que se toca para volver a sacarla. Obligatoria si
 * no pagó, opcional si pagó. Usa la misma cámara y la misma subida que `FotoEntrega`.
 */
export function FirmarRemito({ obligatoria, url, onUrl, onSubiendo, referencia, lugar }: Props) {
  const c = useColors()
  const { subiendo, error, camara, sacar, subir, cerrarCamara } = useFotoEntrega(onUrl, onSubiendo)

  return (
    <View accessibilityLabel="Firma del remito" style={{ gap: space[2] }}>
      {url ? (
        <PressableFx
          onPress={sacar}
          accessibilityRole="button"
          accessibilityLabel="Volver a sacar la foto del remito firmado"
          android_ripple={{ color: c.ink }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radii.fila, backgroundColor: c.teal }}
        >
          <Image source={{ uri: url }} accessibilityLabel="Miniatura del remito firmado" style={{ width: 52, height: 64, borderRadius: radii.campo, backgroundColor: c.border }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Check size={20} color={c.ink} strokeWidth={3} />
              <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: c.ink }}>Remito firmado</Text>
            </View>
            <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: c.ink }}>Tocá para volver a sacarla</Text>
          </View>
          {subiendo ? <ActivityIndicator color={c.ink} /> : null}
        </PressableFx>
      ) : (
        <PressableFx
          onPress={subiendo ? undefined : sacar}
          accessibilityRole="button"
          accessibilityLabel="Firmar"
          accessibilityHint={obligatoria ? 'Abre la cámara: foto del remito firmado' : 'Opcional · foto del remito firmado'}
          accessibilityState={{ busy: subiendo }}
          android_ripple={{ color: c.ink }}
          style={{ alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: space[5], paddingVertical: space[6], borderRadius: radii.tarjetaGrande, backgroundColor: c.lime }}
        >
          {/* Disco ink con la cámara en lime, con un aro de ink al 20 %. */}
          <View style={{ width: 104, height: 104, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: c.veilInk20 }}>
            <View style={{ width: 92, height: 92, borderRadius: radii.pastilla, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
              {subiendo ? <ActivityIndicator color={c.lime} /> : <Camera size={44} color={c.lime} strokeWidth={2.2} />}
            </View>
          </View>
          <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.tituloPantalla, color: c.ink }}>Firmar</Text>
          <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: c.ink, textAlign: 'center' }}>
            {obligatoria ? 'Abre la cámara: foto del remito firmado' : 'Opcional · foto del remito firmado'}
          </Text>
          {/* Excepción aprobada (chofer-05): la pastilla que dice dónde tocar. */}
          <View style={{ backgroundColor: c.ink, borderRadius: radii.pastilla, paddingHorizontal: space[5], minHeight: 48, justifyContent: 'center' }}>
            <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: c.lime }}>Tocá para sacar la foto</Text>
          </View>
        </PressableFx>
      )}
      {obligatoria && !url ? <Notice tone="info">Sin la foto del remito firmado no se cierra la entrega.</Notice> : null}
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <CamaraChofer
        visible={camara}
        titulo="Foto del remito"
        subtitulo={[referencia, lugar].filter(Boolean).join(' · ') || undefined}
        guia={GUIA}
        onCerrar={cerrarCamara}
        onFoto={(uri) => void subir(uri)}
      />
    </View>
  )
}
