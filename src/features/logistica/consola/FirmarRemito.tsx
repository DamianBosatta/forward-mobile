import React from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import { Check, PenLine } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
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
  // Verde de "entregado": fondo oscuro con texto claro en el tema claro y al revés en el oscuro, siempre legible.
  const verde = c.chip.entregado

  return (
    <View accessibilityLabel="Firma del remito" style={{ gap: space[2] }}>
      {url ? (
        <Pressable
          onPress={sacar}
          accessibilityRole="button"
          accessibilityLabel="Volver a sacar la foto del remito firmado"
          android_ripple={{ color: c.border }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[2], borderRadius: radii.tarjeta, borderWidth: 2, borderColor: verde.text, backgroundColor: verde.bg }}
        >
          <Image source={{ uri: url }} accessibilityLabel="Miniatura del remito firmado" style={{ width: 52, height: 64, borderRadius: radii.campo, backgroundColor: c.border }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Check size={20} color={verde.text} strokeWidth={3} />
              <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: verde.text }}>Remito firmado</Text>
            </View>
            <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: c.textSecondary }}>Tocá para volver a sacarla</Text>
          </View>
          {subiendo ? <ActivityIndicator color={verde.text} /> : null}
        </Pressable>
      ) : (
        <Pressable
          onPress={subiendo ? undefined : sacar}
          accessibilityRole="button"
          accessibilityLabel="Firmar"
          accessibilityHint={obligatoria ? 'Abre la cámara: foto del remito firmado' : 'Opcional · foto del remito firmado'}
          accessibilityState={{ busy: subiendo }}
          style={{ minHeight: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radii.tarjeta, backgroundColor: verde.text, borderWidth: 4, borderColor: c.success }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            {subiendo ? <ActivityIndicator color={verde.bg} /> : <PenLine size={26} color={verde.bg} strokeWidth={2.5} />}
            <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.seccion, fontSize: 21, lineHeight: 28, color: verde.bg }}>Firmar</Text>
          </View>
          <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: verde.bg }}>
            {obligatoria ? 'Abre la cámara: foto del remito firmado' : 'Opcional · foto del remito firmado'}
          </Text>
        </Pressable>
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
