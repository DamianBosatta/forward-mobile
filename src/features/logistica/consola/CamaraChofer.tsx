import React, { useRef, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { X, Zap, ZapOff } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'

interface Props {
  visible: boolean
  /** "Foto del remito", "Foto del lugar"… */
  titulo: string
  /** "Remito NTE16918 · Juan B. Justo 6376". */
  subtitulo?: string
  /** Cómo encuadrar, bajo el visor. */
  guia?: string
  onCerrar: () => void
  /** La foto recién sacada (archivo local); quien la pidió la sube. */
  onFoto: (uri: string) => void
}

/** Calidad baja: el servidor acepta hasta 2 MB por foto. */
const CALIDAD = 0.4

/**
 * Lámina ChoferCamara (C3): la cámara propia de la app, a pantalla completa, con el encuadre y la guía.
 * Solo cámara, nunca la galería: la foto se saca en el momento. El permiso se explica como en el escáner.
 */
export function CamaraChofer({ visible, titulo, subtitulo, guia, onCerrar, onFoto }: Props) {
  const c = useColors()
  const { top, bottom } = useSafeAreaInsets()
  const [permiso, pedirPermiso] = useCameraPermissions()
  const camara = useRef<CameraView>(null)
  const [flash, setFlash] = useState(false)
  const [disparando, setDisparando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disparar = async () => {
    if (disparando || !camara.current) return
    setError(null)
    setDisparando(true)
    try {
      const foto = await camara.current.takePictureAsync({ quality: CALIDAD })
      if (foto?.uri) onFoto(foto.uri)
      else setError('No se pudo sacar la foto. Probá de nuevo.')
    } catch {
      setError('No se pudo sacar la foto. Probá de nuevo.')
    } finally {
      setDisparando(false)
    }
  }

  const claro = c.onTopBarStrong
  const aviso = (tituloAviso: string, texto: string, boton: React.ReactNode) => (
    <View style={{ flex: 1, justifyContent: 'center', padding: space[6], gap: space[4] }}>
      <Text style={{ ...typeScale.seccion, color: claro, textAlign: 'center' }}>{tituloAviso}</Text>
      {texto ? <Text style={{ ...typeScale.cuerpo, color: claro, textAlign: 'center' }}>{texto}</Text> : null}
      {boton}
    </View>
  )

  let contenido: React.ReactNode
  if (!permiso) {
    contenido = aviso('Revisando el permiso de la cámara…', '', null)
  } else if (!permiso.granted) {
    contenido = permiso.canAskAgain
      ? aviso(
          'Falta el permiso de la cámara',
          'Para sacar la foto, Forward necesita usar la cámara. Las fotos se sacan en el momento, no desde la galería.',
          <Button label="Permitir la cámara" onPress={() => void pedirPermiso()} />,
        )
      : aviso(
          'La cámara está bloqueada para Forward',
          'Se negó el permiso. Habilitalo en la configuración del teléfono para sacar la foto.',
          <Button label="Abrir la configuración" onPress={() => void Linking.openSettings()} />,
        )
  } else {
    contenido = (
      <>
        <View style={{ flex: 1, marginHorizontal: space[4], borderRadius: radii.tarjeta, overflow: 'hidden', backgroundColor: c.topBar }}>
          <CameraView ref={camara} style={StyleSheet.absoluteFill} facing="back" flash={flash ? 'on' : 'off'} />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: space[10], bottom: space[10], left: space[8], right: space[8], borderWidth: 3, borderColor: c.brand, borderRadius: radii.tarjeta }}
          />
        </View>
        {guia ? <Text style={{ ...typeScale.cuerpo, color: claro, textAlign: 'center', marginTop: space[4], marginHorizontal: space[6] }}>{guia}</Text> : null}
        {error ? <View style={{ marginHorizontal: space[4], marginTop: space[2] }}><Notice tone="peligro">{error}</Notice></View> : null}
        <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sacar la foto"
            accessibilityState={{ disabled: disparando, busy: disparando }}
            onPress={disparar}
            style={{ width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: claro, alignItems: 'center', justifyContent: 'center', opacity: disparando ? 0.5 : 1 }}
          >
            <View style={{ width: 60, height: 60, borderRadius: 999, backgroundColor: claro }} />
          </Pressable>
        </View>
      </>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View accessibilityLabel="Cámara" style={{ flex: 1, backgroundColor: c.topBar, paddingTop: top, paddingBottom: bottom }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[1] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar la foto" onPress={onCerrar} style={estilos.boton}>
            <X size={24} color={claro} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...typeScale.seccion, color: claro }} numberOfLines={1}>{titulo}</Text>
            {subtitulo ? <Text style={{ ...typeScale.secundario, color: claro, opacity: 0.7 }} numberOfLines={1}>{subtitulo}</Text> : null}
          </View>
          {permiso?.granted ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={flash ? 'Apagar el flash' : 'Encender el flash'}
              accessibilityState={{ checked: flash }}
              onPress={() => setFlash((f) => !f)}
              style={estilos.boton}
            >
              {flash ? <Zap size={22} color={claro} /> : <ZapOff size={22} color={claro} />}
            </Pressable>
          ) : null}
        </View>
        {contenido}
      </View>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  boton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
